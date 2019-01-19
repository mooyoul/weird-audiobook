import { JSDOM } from "jsdom";

export abstract class TextToSpeechBase {
  public readonly abstract name: string;

  public async abstract speech(html: string, outputS3Location: string): Promise<string[]>;

  protected format(html: string): string {
    const dom = new JSDOM(html);

    return dom.window.document.body.textContent! as string;
  }

  protected chunk(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const paragraphs = text.split("\n"); // @todo find more safer way to split paragraphs

    return paragraphs.reduce((collection, chunk) => {
      let buf = collection[collection.length - 1];

      if (typeof buf === "undefined") {
        buf = "";
        collection.push(buf);
      }

      const concatSize = buf.length + chunk.length;
      if (concatSize <= maxLength) {
        buf = [buf, chunk].join("\n");
        collection[collection.length - 1] = buf;
      } else {
        collection.push(chunk);
      }

      return collection;
    }, [] as string[]);
  }
}
