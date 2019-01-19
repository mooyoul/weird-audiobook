import { Lambda } from "aws-sdk";
import * as debug from "debug";

const lambda = new Lambda();
const log = debug("weird-audiobook:lambda-helper");

export async function invoke<Input, Output>(functionName: string, input: Input): Promise<Output> {
  const result = await lambda.invoke({
    FunctionName: functionName,
    Payload: JSON.stringify(input),
    InvocationType: "RequestResponse",
  }).promise();

  if (result.FunctionError) {
    log("Failed invocation: ", result.Payload);
    throw new Error(result.Payload as string);
  }

  return JSON.parse(result.Payload as string) as Output;
}
