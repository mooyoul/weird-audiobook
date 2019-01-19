export interface SQSRecord {
  messageId: string;
  receiptHandle: string;
  body: string;
  attributes: {
    ApproximateReceiveCount: string;
    SentTimestamp: string;
    SenderId: string;
    ApproximateFirstReceiveTimestamp: string;
    [key: string]: string;
  };
  messageAttributes: {
    [key: string]: string;
  };
  md5OfBody: string;
  eventSource: "aws:sqs";
  eventSourceARN: string;
  awsRegion: string;
}

export interface SQSEvent {
  Records: SQSRecord[];
}
