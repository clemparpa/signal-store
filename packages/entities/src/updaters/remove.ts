import { idsKey, mapKey } from '../internal/keys';
import type { CollectionSlice, CollectionUpdater, EntityConfig, EntityId } from '../types';

export function removeEntity<E, C extends string>(
  id: EntityId,
  cfg: EntityConfig<E, C>,
): CollectionUpdater<E, C> {
  const kIds = idsKey(cfg.collection);
  const kMap = mapKey(cfg.collection);

  return (state) => {
    const currentMap = (state as Record<string, unknown>)[kMap] as Record<EntityId, E>;
    if (!(id in currentMap)) return {};
    const currentIds = (state as Record<string, unknown>)[kIds] as EntityId[];
    const nextMap: Record<EntityId, E> = {};
    for (const key of Object.keys(currentMap)) {
      if (key !== String(id)) nextMap[key] = currentMap[key] as E;
    }
    return {
      [kIds]: currentIds.filter((existing) => existing !== id),
      [kMap]: nextMap,
    } as Partial<CollectionSlice<E, C>>;
  };
}

export function removeEntities<E, C extends string>(
  ids: readonly EntityId[],
  cfg: EntityConfig<E, C>,
): CollectionUpdater<E, C> {
  const kIds = idsKey(cfg.collection);
  const kMap = mapKey(cfg.collection);

  return (state) => {
    if (ids.length === 0) return {};
    const currentMap = (state as Record<string, unknown>)[kMap] as Record<EntityId, E>;
    const toRemove = new Set<string>(ids.map(String));

    const nextMap: Record<EntityId, E> = {};
    let removedCount = 0;
    for (const key of Object.keys(currentMap)) {
      if (toRemove.has(key)) {
        removedCount += 1;
      } else {
        nextMap[key] = currentMap[key] as E;
      }
    }
    if (removedCount === 0) return {};
    const currentIds = (state as Record<string, unknown>)[kIds] as EntityId[];
    return {
      [kIds]: currentIds.filter((id) => !toRemove.has(String(id))),
      [kMap]: nextMap,
    } as Partial<CollectionSlice<E, C>>;
  };
}

export function removeAllEntities<E, C extends string>(
  cfg: EntityConfig<E, C>,
): CollectionUpdater<E, C> {
  const kIds = idsKey(cfg.collection);
  const kMap = mapKey(cfg.collection);

  return () =>
    ({
      [kIds]: [] as EntityId[],
      [kMap]: {} as Record<EntityId, E>,
    }) as Partial<CollectionSlice<E, C>>;
}
