import { S3 } from "aws-sdk";
const rateLimit = require("async-sema/rate-limit") as (rps: number) => () => Promise<void>; // tslint:disable-line
import * as debug from "debug";
import * as execa from "execa";
import * as fs from "fs";
import * as mimeTypes from "mime-types";
import * as moment from "moment";
import * as os from "os";
import * as path from "path";

import * as S3Helper from "../helpers/s3";
import * as WorkspaceHelper from "../helpers/workspace";
import { BaseType } from "../models";

const log = debug("weird-audiobook:audio-processor");
const s3 = new S3();

export enum TranscodingPreset {
  HLS_AAC_MEDIUM,
  HTTP_MP3_MEDIUM,
}

export interface AudioTranscoderInput {
  source: string;
  destination: string;
  preset: TranscodingPreset;
}

export interface AudioTranscoderOutput {
  location: string;
  transport: BaseType.Transport;
  codec: BaseType.AudioCodec;
  bitrate: number;
  duration: string;
}

const MAX_UPLOAD_CONCURRENCY = 16;
const DEFAULT_CACHE_CONTROL = "public, max-age=3153600000";

export async function handler(event: AudioTranscoderInput): Promise<AudioTranscoderOutput> {
  log("got event: %j", event);

  log("preparing workspace");
  const workspaceDir = path.join(os.tmpdir(), "workspace");
  await WorkspaceHelper.setup(workspaceDir);

  const source = S3Helper.parseUrl(event.source);
  const destination = S3Helper.parseUrl(event.destination);
  log("source: %j, destination: %j", source, destination);

  // we need to create promise instance manually
  // since currently `getSignedUrl` method does not provide Promise interface.
  const sourceUrl = await new Promise<string>((resolve, reject) => {
    s3.getSignedUrl("getObject", {
      Bucket: source.bucket,
      Key: source.key,
      Expires: 300,
    }, (e, signed) => {
      if (e) { return reject(e); }

      resolve(signed);
    });
  });

  log("preparing output dir");
  const outputDir = await new Promise<string>((resolve, reject) => {
    const dir = path.join(workspaceDir, "output");
    fs.mkdir(dir, (e) => {
      if (e) { return reject(e); }

      resolve(dir);
    });
  });

  const ffmpegArgs: string[] = (() => {
    const base = [
      "-loglevel", "warning",
      "-timeout", `10000`, // in microseconds
      "-reconnect", "1",
      "-i", sourceUrl,
      "-vn",
    ];

    switch (event.preset) {
      case TranscodingPreset.HTTP_MP3_MEDIUM:
        return [
          ...base,
          "-c:a", "libmp3lame",
          "-b:a", "48k", // 48kbps
          "-ar", "16000", // 16KHz
          "-ac", "1", // mono
          "-f", "mp3", // mp3 is self-contained format
          path.join(outputDir, "medium.mp3"),
        ];
      case TranscodingPreset.HLS_AAC_MEDIUM:
        return [
          ...base,
          // I know fdk-aac is known for better quality, but this audio is just voice.
          // In this case, quality is not important thing. also i'm not sure about fdk-aac license issues.
          // so i choose libavcodec instead.
          "-c:a", "aac",
          "-b:a", "32k", // 32kbps
          "-ar", "16000", // 16KHz
          "-ac", "1", // mono
          "-f", "hls",
          "-hls_playlist_type", "vod",
          "-hls_time", "15", // 15sec hls segment duration
          "-hls_segment_filename", "s_%08d.ts",
          path.join(outputDir, "medium.m3u8"),
        ];
    }
  })();
  log("generated ffmpeg args:", ffmpegArgs);

  const outputFilePath = ffmpegArgs[ffmpegArgs.length - 1];

  log("start encoding");
  await execa(process.env.FFMPEG_BINARY_PATH!, ffmpegArgs, { cwd: outputDir });
  log("end encoding. uploading to s3");

  const res = await s3.upload({
    Bucket: destination.bucket,
    Key: path.join(destination.key, path.basename(outputFilePath)),
    Body: fs.createReadStream(outputFilePath),
    ContentType: mimeTypes.contentType(path.basename(outputFilePath)) as string,
    CacheControl: DEFAULT_CACHE_CONTROL,
  }).promise();

  log("uploaded master file");

  // HLS produces MPEG2 Transport Stream segments. we need to upload those files to s3
  if (event.preset === TranscodingPreset.HLS_AAC_MEDIUM) {
    const limiter = rateLimit(MAX_UPLOAD_CONCURRENCY);

    const segments = await new Promise<string[]>((resolve, reject) => {
      fs.readdir(outputDir, (e, files) => {
        if (e) { return reject(e); }

        const paths = files
          .filter((f) => path.extname(f) === ".ts")
          .map((f) => path.join(outputDir, f));

        resolve(paths);
      });
    });

    await Promise.all(segments.map(async (segment) => {
      await limiter();

      await s3.upload({
        Bucket: destination.bucket,
        Key: path.join(destination.key, path.basename(segment)),
        Body: fs.createReadStream(segment),
        ContentType: mimeTypes.contentType(path.basename(segment)) as string,
        CacheControl: DEFAULT_CACHE_CONTROL,
      }).promise();
    }));
  }

  log("getting description");
  const description = await (async () => {
    const { stdout } = await execa(process.env.FFPROBE_BINARY_PATH!, [
      "-v", "error",
      "-print_format", "json",
      "-show_format", "-show_streams",
      "-protocol_whitelist", "file,http,https,tcp,tls",
      outputFilePath,
    ]);

    const inspected = JSON.parse(stdout);
    const duration = parseFloat(inspected.format.duration);

    return {
      duration,
    };
  })();

  log("done");

  return {
    location: S3Helper.serializeUrl({
      bucket: res.Bucket,
      key: res.Key,
    }),
    transport: (() => {
      switch (event.preset) {
        case TranscodingPreset.HTTP_MP3_MEDIUM:
          return BaseType.Transport.HTTP;
        case TranscodingPreset.HLS_AAC_MEDIUM:
          return BaseType.Transport.HLS;
      }
    })(),
    codec: (() => {
      switch (event.preset) {
        case TranscodingPreset.HTTP_MP3_MEDIUM:
          return BaseType.AudioCodec.MP3;
        case TranscodingPreset.HLS_AAC_MEDIUM:
          return BaseType.AudioCodec.AAC_LC;
      }
    })(),
    bitrate: (() => {
      switch (event.preset) {
        case TranscodingPreset.HTTP_MP3_MEDIUM:
          return 64 * 1024;
        case TranscodingPreset.HLS_AAC_MEDIUM:
          return 48 * 1024;
      }
    })(),
    duration: moment.duration(description.duration, "seconds").toISOString(),
  };
}
