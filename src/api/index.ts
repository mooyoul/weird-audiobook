import * as _ from "lodash";
import {
  EntityPresenterFactory,
  Namespace,
  Router,
  SwaggerRoute,
} from "vingle-corgi";

import * as Presenters from "./presenters";
import { routes } from "./routes";
import { CORSMiddleware } from "./cors-middleware";

const router = new Router([
  new SwaggerRoute(
    "/api/swagger",
    {
      title: "WeirdAudioBookService",
      version: "1.0.0",
      definitions: {
        ...EntityPresenterFactory.schemas(),
        ..._.mapValues(Presenters, (p) => p.outputJSONSchema()),
      },
    },
    routes,
  ),
  new Namespace("/api", {
    children: routes,
  }),
], {
  middlewares: [
    new CORSMiddleware(),
  ],
});

export const handler = router.handler();
