import { ClassValidator, EntityPresenterFactory } from "vingle-corgi";

import * as S3Helper from "../../helpers/s3";
import { AudioBook, BaseType } from "../../models";

// tslint:disable:max-classes-per-file
export class AudioBookStatusEntity {
  @ClassValidator.IsString()
  public name: string;

  @ClassValidator.IsNumber()
  public updated_at: number; // tslint:disable-line
}

export class AudioBookResourceEntity {
  @ClassValidator.IsString()
  public url: string;

  @ClassValidator.IsString()
  public speaker: string;

  @ClassValidator.IsString()
  public transport: string;

  @ClassValidator.IsString()
  public codec: string;

  @ClassValidator.IsNumber()
  public bitrate: number;

  @ClassValidator.IsString()
  public duration: string;
}

export class AudioBookEntity {
  @ClassValidator.IsNumber()
  public id: number;

  @ClassValidator.ValidateNested()
  public status: AudioBookStatusEntity;

  @ClassValidator.Validate(ClassValidator.ValidateEntityArray, [AudioBookResourceEntity])
  @ClassValidator.IsOptional()
  public resources?: AudioBookResourceEntity[];
}

export const presenter =
  EntityPresenterFactory.create(AudioBookEntity, (input: AudioBook) => {
    const entity = new AudioBookEntity();
    entity.id = input.id;
    entity.status = (() => {
      const status = new AudioBookStatusEntity();
      status.name = BaseType.AudioBookStatusCode[input.status.code];
      status.updated_at = input.status.updatedAt;

      return status;
    })();

    if (input.status.code === BaseType.AudioBookStatusCode.AVAILABLE) {
      entity.resources = input.resources.map((r) => {
        const resource = new AudioBookResourceEntity();
        const { key } = S3Helper.parseUrl(r.location);
        resource.url = `${process.env.AUDIOBOOK_CDN_BASE_URL}/${key}`;
        resource.speaker = BaseType.Speaker[r.speaker];
        resource.transport = BaseType.Transport[r.transport];
        resource.codec = BaseType.AudioCodec[r.codec];
        resource.bitrate = r.bitrate;
        resource.duration = r.duration;

        return resource;
      });
    }

    return entity;
  });

// tslint:enable:max-classes-per-file
