import { DynamoDB } from "aws-sdk";
import { AudioBook } from "../src/models";

const ddb = new DynamoDB();

// tslint:disable:no-console
(async () => {
  if (!process.env.STAGE) {
    console.error("STAGE environment variable is missing.");
    return;
  }

  const tableName = AudioBook.metadata.name;
  console.log("checking table existence...");
  const exists = await (async () => {
    try {
      await ddb.describeTable({
        TableName: tableName,
      }).promise();

      return true;
    } catch (e) {
      if (e.code === "ResourceNotFoundException") {
        return false;
      }

      throw e;
    }
  })();

  if (exists) {
    console.error("table %s already exists. exiting.");
    return;
  }

  console.log("creating table %s ...", tableName);
  await AudioBook.createTable();
  console.log("updating capacity billing mode to on-demand");
  await ddb.updateTable({
    TableName: tableName,
    BillingMode: "PAY_PER_REQUEST",
  }).promise();
  console.log("update request was successfully submitted. Applying changes may takes up to 15 minutes.");
  console.log("checking table status...");

  while (true) {
    const res = await ddb.describeTable({ TableName: tableName }).promise();

    const status = res.Table!.TableStatus;

    console.log("Table %s status: ", tableName, status);
    if (status !== "UPDATING") {
      break;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 10000));
  }

  console.log("\ndone");
})().catch(console.error);
// tslint:enable:no-console
