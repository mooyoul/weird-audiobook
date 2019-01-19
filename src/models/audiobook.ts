import {
  Decorator,
  Query,
  Table,
} from "dynamo-types";

import {
  AudioBookResource,
  AudioBookStatus,
  AudioBookStatusCode,
} from "./base";

@Decorator.Table({ name: `weird_${process.env.STAGE}_audiobooks` })
export class AudioBook extends Table {
  @Decorator.HashPrimaryKey("id")
  public static readonly primaryKey: Query.HashPrimaryKey<AudioBook, number>;

  @Decorator.Writer()
  public static readonly writer: Query.Writer<AudioBook>;

  public static create(id: number) {
    const model = new this();
    model.id = id;
    model.status = {
      code: AudioBookStatusCode.QUEUED,
      updatedAt: Date.now(),
    };

    return model;
  }

  @Decorator.Attribute()
  public id: number;

  @Decorator.Attribute({ name: "s" })
  public statusHistories: AudioBookStatus[] = [];

  public get status(): AudioBookStatus { // indicates current status
    return this.statusHistories[this.statusHistories.length - 1] || {
      code: AudioBookStatusCode.UNKNOWN,
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }

  public set status(status: AudioBookStatus) {
    if (status.code !== AudioBookStatusCode.UNKNOWN) {
      this.statusHistories.push(status);
    }
  }

  @Decorator.Attribute({ name: "r" })
  public resources: AudioBookResource[] = [];
}
