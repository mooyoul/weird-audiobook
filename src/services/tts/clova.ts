import { S3 } from "aws-sdk";
import axios from "axios";
import * as debug from "debug";
import * as path from "path";
import * as qs from "qs";

import * as S3Helper from "../../helpers/s3";
import { TextToSpeechBase } from "./base";

export interface ClovaCredentials {
  clientId: string;
  clientSecret: string;
}

export class ClovaTextToSpeech extends TextToSpeechBase {
  public readonly name = "clova";
  private readonly credentials: ClovaCredentials;
  private readonly s3 = new S3();
  private readonly log = debug("weird-audiobook:ClovaTextToSpeech");

  constructor(credentials: ClovaCredentials) {
    super();

    this.credentials = credentials;
  }

  public async speech(html: string, outputS3Location: string, options: {
    speed?: number;
    voice?: "mijin" | "jinho";
  } = {}) {
    const {
      speed = 1,
      voice = "mijin",
    } = options;

    const text = this.format(html);
    this.log("generating tts audio from %d chars", text.length);

    const { bucket, key: prefix } = S3Helper.parseUrl(outputS3Location);

    return await Promise.all(this.chunk(text, 4000).map(async (chunk, index) => {
      this.log("requesting to clova");

      const response = await axios({
        method: "POST",
        url: "https://naveropenapi.apigw.ntruss.com/voice/v1/tts",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
          "X-NCP-APIGW-API-KEY-ID": this.credentials.clientId,
          "X-NCP-APIGW-API-KEY": this.credentials.clientSecret,
        },
        data: qs.stringify({
          speaker: voice,
          speed,
          text: chunk,
        }),
        responseType: "stream",
      });

      const key = path.join(prefix, `${voice}_${index}.mp3`);
      this.log("got %d from server, uploading to %s - %s", response.status, bucket, key);
      const result = await this.s3.upload({
        Bucket: bucket,
        Key: key,
        Body: response.data,
      }).promise();

      return S3Helper.serializeUrl({
        bucket: result.Bucket,
        key: result.Key,
      });
    }));
  }
}
