import { Polly } from "aws-sdk";
import * as debug from "debug";
import * as path from "path";

import * as S3Helper from "../../helpers/s3";
import { TextToSpeechBase } from "./base";

export class PollyTextToSpeech extends TextToSpeechBase {
  public readonly name = "polly";
  public readonly log = debug("weird-audiobook:polly");
  private readonly polly = new Polly();

  public async speech(html: string, outputS3Location: string) {
    const text = this.format(html);
    this.log("generating tts audio from %d chars", text.length);

    const { bucket, key: prefix } = S3Helper.parseUrl(outputS3Location);

    return await Promise.all(this.chunk(text, 50000).map(async (chunk, index) => {
      const key = path.join(prefix, `seoyeon_${index}`);

      const res = await this.polly.startSpeechSynthesisTask({
        OutputFormat: "mp3",
        OutputS3BucketName: bucket,
        OutputS3KeyPrefix: key,
        VoiceId: "Seoyeon",
        Text: chunk,
        // @todo migrate to SSML
        TextType: "text",
      }).promise();

      while (true) {
        const task = await this.polly.getSpeechSynthesisTask({
          TaskId: res.SynthesisTask!.TaskId!,
        }).promise();

        switch (task.SynthesisTask!.TaskStatus) {
          case "scheduled":
          case "inProgress": {
            await sleep(500);
            break;
          }
          case "completed": {
            return S3Helper.serializeUrl(
              // since output url is HTTP URL. we need to parse this to convert S3 URL
              S3Helper.parseUrl(res.SynthesisTask!.OutputUri!),
            );
          }
          case "failed": {
            this.log("Failed to speech text using polly: %j", res.SynthesisTask);
            throw new Error("Failed to speech text");
          }
          default: {
            this.log("Got unknown task status: %j", res.SynthesisTask);
            throw new Error("Unexpected synthesis task status");
          }
        }
      }
    }));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
