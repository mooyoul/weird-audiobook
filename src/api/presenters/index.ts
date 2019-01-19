import { DataLayoutPresenter } from "vingle-corgi";

import * as Audiobook from "./audiobook";
import * as Success from "./success";

export const AudioBookItem = new DataLayoutPresenter(Audiobook.presenter);
export const Succeed = new DataLayoutPresenter(Success.presenter);
