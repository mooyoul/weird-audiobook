import { Middleware, MiddlewareAfterOptions } from "vingle-corgi";

const ONE_MINUTE = 60;

export class CORSMiddleware implements Middleware<void> {
  private ALLOWED_ORIGINS = new Set<string>([
    "http://blog.weirdx.io",
    "https://blog.weirdx.io",
    process.env.AUDIOBOOK_CDN_BASE_URL!,
    "http://www.lvh.me:8080",
  ]);

  public async before() {
    // do nothing
  }

  public async after(options: MiddlewareAfterOptions<void>) {
    const { response } = options;
    const { origin = "" } = options.routingContext.headers;

    if (this.ALLOWED_ORIGINS.has(origin)) {
      const requestedMethod = options.routingContext.request.httpMethod;

      Object.assign(response.headers, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": [
          requestedMethod,
        ].join(", "),
        "Access-Control-Max-Age": ONE_MINUTE,
      });
    }

    return response;
  }
}
