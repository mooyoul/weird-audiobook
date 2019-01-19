import { S3 } from "aws-sdk";
import * as debug from "debug";
import * as execa from "execa";
import * as os from "os";
import * as path from "path";

import * as S3Helper from "../helpers/s3";
import * as StreamHelper from "../helpers/stream";
import * as WorkspaceHelper from "../helpers/workspace";

const log = debug("weird-audiobook:audio-joiner");
const s3 = new S3();

export interface AudioJoinerInput {
  sources: string[];
  destination: string;
}

export interface AudioJoinerOutput {
  location: string;
}

export async function handler(event: AudioJoinerInput): Promise<AudioJoinerOutput> {
  log("got event: %j", event);

  log("preparing workspace");
  const workspaceDir = path.join(os.tmpdir(), "workspace");
  const destination = S3Helper.parseUrl(event.destination);

  // Setup workspace
  await WorkspaceHelper.setup(workspaceDir);

  // download files to workspace
  log("downloading inputs to workspace");
  const sources = await Promise.all(event.sources.map(async (source) => {
    const { bucket, key } = S3Helper.parseUrl(source);
    const dest = path.join(workspaceDir, path.basename(key));

    await StreamHelper.toFile(
      s3.getObject({ Bucket: bucket, Key: key }).createReadStream(),
      dest,
    );

    return dest;
  }));

  // join source files and upload to s3
  log("joining %d sources to %s", sources.length, event.destination);
  const result = await new Promise<S3.ManagedUpload.SendData>((resolve, reject) => {
    let stderr = "";

    const args: string[] = [
      ...sources,
      "-t", "mp3",
      "-",
    ];

    log("spawning sox process");
    const proc = execa(process.env.SOX_BINARY_PATH! as string, args)
      .once("error", onError)
      .once("exit", onExit);

    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (data: string) => {
      stderr += data;
    });

    s3.upload({
      Bucket: destination.bucket,
      Key: destination.key,
      Body: proc.stdout,
    }).promise().then(resolve).catch(reject);

    function onError(e: Error) {
      proc.removeListener("exit", onExit);
      reject(e);
    }

    function onExit(code: number, signal: string) {
      proc.removeListener("error", onError);
      log("sox process exited with %d (signal: %s)", code, signal);

      if (code !== 0) {
        log("stderr: ", stderr);
        reject(new Error("Process exited with non-zero code"));
      }
    }
  });

  log("DONE");

  // upload merged files to s3
  return {
    location: S3Helper.serializeUrl({ bucket: result.Bucket, key: result.Key }),
  };
}
