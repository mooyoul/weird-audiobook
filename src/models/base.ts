export enum Transport {
  HTTP = 0,
  HLS = 1, // reserved for future usage
  MPEG_DASH = 2, // reserved for future usage
}

export enum AudioCodec {
  MP3 = 0,
  AAC_LC = 1,
  HE_AAC = 2, // reserved for future usage
}

export enum Speaker {
  AWS_POLLY_SEOYEON,
  NAVER_CLOVA_CSS_MIJIN,
  NAVER_CLOVA_CSS_JINHO,
}

export enum AudioBookStatusCode {
  UNKNOWN = -1,
  QUEUED = 100,
  PROCESSING = 200,
  AVAILABLE = 300,
  FAILED = 400,
}

export enum FailureReason {
  INTERNAL_ERROR = 0,
}

export interface AudioBookResource {
  location: string;
  speaker: Speaker;
  transport: Transport;
  codec: AudioCodec;
  bitrate: number; // overall bitrate (video + audio)
  duration: string; // ISO8601 duration
}

export type AudioBookStatus = ({
  code: AudioBookStatusCode.UNKNOWN
    | AudioBookStatusCode.QUEUED
    | AudioBookStatusCode.PROCESSING
    | AudioBookStatusCode.AVAILABLE
  updatedAt: number;
} | {
  code: AudioBookStatusCode.FAILED;
  updatedAt: number;
  reason: FailureReason;
});
