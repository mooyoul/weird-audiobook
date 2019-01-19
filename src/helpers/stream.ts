import * as fs from "fs";
import { Readable } from "stream";

export function toFile(readable: Readable, destination: string) {
  return new Promise<void>((resolve, reject) => {
    const outputStream = fs.createWriteStream(destination)
      .once("error", onWriteError)
      .once("finish", onFinish);

    readable.pipe(outputStream);

    function onWriteError(e: Error) {
      readable.removeListener("error", onReadError);
      outputStream.removeListener("finish", onFinish);
      reject(e);
    }

    function onReadError(e: Error) {
      outputStream.removeListener("error", onWriteError);
      outputStream.removeListener("finish", onFinish);
      reject(e);
      // One important caveat is that if the Readable stream emits an error during processing,
      // the Writable destination is not closed automatically.
      // If an error occurs, it will be necessary to manually close each stream in order to prevent memory leaks.
      // @see https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
      outputStream.end();
    }

    function onFinish() {
      readable.removeListener("error", onReadError);
      outputStream.removeListener("error", onWriteError);
      resolve();
    }
  });
}
