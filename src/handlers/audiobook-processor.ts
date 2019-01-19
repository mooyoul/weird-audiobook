import { stripIndent as html } from "common-tags";
import * as debug from "debug";
import * as _ from "lodash";
import * as path from "path";

import * as LambdaHelper from "../helpers/lambda";
import * as S3Helper from "../helpers/s3";
import { SQSEvent } from "../interfaces/sqs_event";
import { AudioBook, BaseType } from "../models";
import { ClovaTextToSpeech, PollyTextToSpeech } from "../services/tts";
import { WeirdBlog } from "../services/weird-blog";
import { AudioJoinerInput, AudioJoinerOutput } from "./audio-joiner";
import { AudioTranscoderInput, AudioTranscoderOutput, TranscodingPreset } from "./audio-transcoder";

const log = debug("weird-audiobook:audiobook-processor");

const clova = new ClovaTextToSpeech({
  clientId: process.env.CLOVA_CSS_CLIENT_ID! as string,
  clientSecret: process.env.CLOVA_CSS_CLIENT_SECRET! as string
});
const polly = new PollyTextToSpeech();

const presets = new Set([
  TranscodingPreset.HLS_AAC_MEDIUM,
  TranscodingPreset.HTTP_MP3_MEDIUM,
]);

const speakers = new Map<BaseType.Speaker, ((content: string, outputLocation: string) => Promise<string[]>)>([[
    BaseType.Speaker.AWS_POLLY_SEOYEON,
    (content, outputLocation) => polly.speech(content, outputLocation),
  ], [
    BaseType.Speaker.NAVER_CLOVA_CSS_MIJIN,
    (content, outputLocation) => clova.speech(content, outputLocation, { voice: "mijin" }),
  ], [
    BaseType.Speaker.NAVER_CLOVA_CSS_JINHO,
    (content, outputLocation) => clova.speech(content, outputLocation, { voice: "jinho" })
  ],
]);

export interface AudiobookProcessorTask {
  id: number;
}

export class HandledError extends Error {
  public readonly retryable: boolean;
  public readonly reason: BaseType.FailureReason;

  constructor(message: string, metadata: {
    retryable: boolean;
    reason: BaseType.FailureReason;
  }) {
    super(message);

    this.retryable = metadata.retryable;
    this.reason = metadata.reason;
  }
}

export async function handler(event: SQSEvent) {
  const { Records } = event;

  for (const record of Records) {
    const task = JSON.parse(record.body) as AudiobookProcessorTask;
    const book = await AudioBook.primaryKey.get(task.id);

    if (!book) {
      log("Failed to find AudioBook record (id: %s)", task.id);
      continue;
    }

    try {
      // Update status
      book.status = {
        code: BaseType.AudioBookStatusCode.PROCESSING,
        updatedAt: Date.now(),
      };

      await book.save();

      // Get article contents
      const article = await WeirdBlog.read(book.id);
      const content = html`
        <h1>${article.title}</h1>
        <p>${article.category}</p>
        <div>
          ${article.content}
        </div>
      `;

      // Generate TTS audio & Perform audio conversion
      const tmpS3Location: S3Helper.Location = {
        bucket: process.env.AUDIOBOOK_BUCKET!,
        key: `processing/${book.id}`,
      };
      const outputLocation: S3Helper.Location = {
        bucket: process.env.AUDIOBOOK_BUCKET!,
        key: `audiobooks/${book.id}`,
      };

      log("tmp: %j, output: %j", tmpS3Location, outputLocation);
      const resources = await Promise.all<BaseType.AudioBookResource[]>(
        Array.from(speakers.entries()).map(async ([ speaker, speech ]) => {
          const speakerName = BaseType.Speaker[speaker];

          log("[%s] generating tts audio", speakerName);
          const speeches = await speech(content, S3Helper.serializeUrl(tmpS3Location));
          log("[%s] generated tts audio", speakerName);

          // join audio chunks if needed
          const ttsOutputLocation = await (async () => {
            if (speeches.length === 1) {
              log("[%s] tts output is not chunked, skipping join process", speakerName);
              return speeches[0];
            }

            log("[%s] joining %d %s tts outputs", speakerName, speeches.length);
            const joined = await LambdaHelper.invoke<AudioJoinerInput, AudioJoinerOutput>(
              process.env.AUDIO_JOINER_FUNCTION_NAME!,
              {
                sources: speeches,
                destination: S3Helper.serializeUrl({
                  bucket: tmpS3Location.bucket,
                  key: path.join(tmpS3Location.key, `${speakerName}_joined.mp3`),
                }),
              },
            );
            log("[%s] joined tts outputs: %j", speakerName, joined);

            return joined.location;
          })();

          const outputs = await Promise.all(
            Array.from(presets.values()).map(async (preset) => {
              const presetName = TranscodingPreset[preset];

              log("[%s][%s] start transcoding...", speakerName, presetName);
              const res = await LambdaHelper.invoke<AudioTranscoderInput, AudioTranscoderOutput>(
                process.env.AUDIO_TRANSCODER_FUNCTION_NAME!,
                {
                  source: ttsOutputLocation,
                  destination: S3Helper.serializeUrl({
                    bucket: outputLocation.bucket,
                    key: path.join(outputLocation.key, speaker.toString()),
                  }),
                  preset,
                },
              );
              log("[%s][%s] end transcoding", speakerName, presetName);

              return res;
            }),
          );

          return outputs.map((output) => ({
            speaker,
            transport: output.transport,
            location: output.location,
            codec: output.codec,
            bitrate: output.bitrate,
            duration: output.duration,
          }));
        }),
      );

      log("updating model...");
      book.status = {
        code: BaseType.AudioBookStatusCode.AVAILABLE,
        updatedAt: Date.now(),
      };
      book.resources = _.flatten(resources);
      await book.save();

      log("done");
    } catch (e) {
      let retryable = false;

      if (e instanceof HandledError) {
        book.status = {
          code: BaseType.AudioBookStatusCode.FAILED,
          reason: e.reason,
          updatedAt: Date.now(),
        };

        retryable = e.retryable;
      } else {
        log("Caught unknown error: ", e.stack);

        book.status = {
          code: BaseType.AudioBookStatusCode.FAILED,
          reason: BaseType.FailureReason.INTERNAL_ERROR,
          updatedAt: Date.now(),
        };
      }

      await book.save();

      if (retryable) {
        throw e;
      }
    }
  }
}
