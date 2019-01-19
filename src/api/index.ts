import * as _ from "lodash";
import {
  EntityPresenterFactory,
  Namespace,
  Router,
  SwaggerRoute,
} from "vingle-corgi";

import * as Presenters from "./presenters";
import { routes } from "./routes";

const router = new Router([
  new SwaggerRoute(
    "/swagger",
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
  new Namespace("", {
    children: routes,
  }),
], {
  middlewares: [
  ],
});

export const handler = router.handler();
