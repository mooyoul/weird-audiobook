import { ClassValidator, EntityPresenterFactory } from "vingle-corgi";

import { AudioBook } from "../../models";

export class AudioBookEntity {
  @ClassValidator.IsNumber()
  public id: number;
}

export const presenter =
  EntityPresenterFactory.create(AudioBookEntity, (input: AudioBook) => {
    const entity = new AudioBookEntity();
    entity.id = input.id;
    return entity;
  });
