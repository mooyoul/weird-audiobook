import { URL } from "url";

export interface Location {
  bucket: string;
  key: string;
}

export function parseUrl(url: string): Location {
  const parsed = new URL(url);

  switch (parsed.protocol) {
    case "s3:":
      return parseS3Url(parsed);
    case "http:":
    case "https:":
      return parseHTTPUrl(parsed);
    default:
      throw new Error("Unsupported protocol");
  }
}

export function serializeUrl(location: Location): string {
  return `s3://${location.bucket}/${location.key}`;
}

function parseS3Url(url: URL): Location {
  return {
    bucket: url.hostname,
    key: url.pathname.slice(1),
  };
}

function parseHTTPUrl(url: URL): Location {
  const [ hostPrefix ] = url.hostname.split(".");
  if (hostPrefix === "s3") {
    const [ bucketName, ...keyParts ] = url.pathname.slice(1).split("/");

    return {
      bucket: bucketName,
      key: keyParts.join("/"),
    };
  } else {
    return {
      bucket: hostPrefix,
      key: url.pathname.slice(1),
    };
  }
}
