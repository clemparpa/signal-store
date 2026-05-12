import { idsKey, mapKey } from '../internal/keys';
import type { CollectionSlice, CollectionUpdater, EntityConfig, EntityId } from '../types';

export function setEntity<E, C extends string>(
  entity: E,
  cfg: EntityConfig<E, C>,
): CollectionUpdater<E, C> {
  const kIds = idsKey(cfg.collection);
  const kMap = mapKey(cfg.collection);
  const id = cfg.selectId(entity);

  return (state) => {
    const currentMap = (state as Record<string, unknown>)[kMap] as Record<EntityId, E>;
    const currentIds = (state as Record<string, unknown>)[kIds] as EntityId[];
    const exists = id in currentMap;
    return {
      [kIds]: exists ? currentIds : [...currentIds, id],
      [kMap]: { ...currentMap, [id]: entity },
    } as Partial<CollectionSlice<E, C>>;
  };
}

export function setEntities<E, C extends string>(
  entities: readonly E[],
  cfg: EntityConfig<E, C>,
): CollectionUpdater<E, C> {
  const kIds = idsKey(cfg.collection);
  const kMap = mapKey(cfg.collection);

  return (state) => {
    if (entities.length === 0) return {};
    const currentMap = (state as Record<string, unknown>)[kMap] as Record<EntityId, E>;
    const currentIds = (state as Record<string, unknown>)[kIds] as EntityId[];
    const newMap: Record<EntityId, E> = { ...currentMap };
    const appendedIds: EntityId[] = [];
    for (const e of entities) {
      const id = cfg.selectId(e);
      if (!(id in newMap)) appendedIds.push(id);
      newMap[id] = e;
    }
    return {
      [kIds]: appendedIds.length === 0 ? currentIds : [...currentIds, ...appendedIds],
      [kMap]: newMap,
    } as Partial<CollectionSlice<E, C>>;
  };
}

export function setAllEntities<E, C extends string>(
  entities: readonly E[],
  cfg: EntityConfig<E, C>,
): CollectionUpdater<E, C> {
  const kIds = idsKey(cfg.collection);
  const kMap = mapKey(cfg.collection);

  return () => {
    const nextIds: EntityId[] = [];
    const nextMap: Record<EntityId, E> = {};
    for (const e of entities) {
      const id = cfg.selectId(e);
      if (!(id in nextMap)) nextIds.push(id);
      nextMap[id] = e;
    }
    return {
      [kIds]: nextIds,
      [kMap]: nextMap,
    } as Partial<CollectionSlice<E, C>>;
  };
}
