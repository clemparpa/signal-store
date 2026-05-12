import type { EntityConfig, EntityId } from './types';

const defaultSelectId = <E>(entity: E): EntityId => (entity as { id: EntityId }).id;

export function entityConfig<E, C extends string = ''>(opts?: {
  collection?: C;
  selectId?: (entity: E) => EntityId;
}): EntityConfig<E, C> {
  return {
    collection: (opts?.collection ?? '') as C,
    selectId: opts?.selectId ?? defaultSelectId,
  };
}
