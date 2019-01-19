import { ClassValidator, EntityPresenterFactory } from "vingle-corgi";

export class SuccessEntity {
  @ClassValidator.IsBoolean()
  public success: boolean;
}

export const presenter =
  EntityPresenterFactory.create(SuccessEntity, (input: boolean) => {
    const entity = new SuccessEntity();
    entity.success = input;
    return entity;
  });
