import { idsKey, mapKey } from '../internal/keys';
import type { CollectionSlice, CollectionUpdater, EntityConfig, EntityId } from '../types';

export function addEntity<E, C extends string>(
  entity: E,
  cfg: EntityConfig<E, C>,
): CollectionUpdater<E, C> {
  const kIds = idsKey(cfg.collection);
  const kMap = mapKey(cfg.collection);
  const id = cfg.selectId(entity);

  return (state) => {
    const currentMap = (state as Record<string, unknown>)[kMap] as Record<EntityId, E>;
    if (id in currentMap) return {};
    const currentIds = (state as Record<string, unknown>)[kIds] as EntityId[];
    return {
      [kIds]: [...currentIds, id],
      [kMap]: { ...currentMap, [id]: entity },
    } as Partial<CollectionSlice<E, C>>;
  };
}

export function addEntities<E, C extends string>(
  entities: readonly E[],
  cfg: EntityConfig<E, C>,
): CollectionUpdater<E, C> {
  const kIds = idsKey(cfg.collection);
  const kMap = mapKey(cfg.collection);

  return (state) => {
    const currentMap = (state as Record<string, unknown>)[kMap] as Record<EntityId, E>;
    const currentIds = (state as Record<string, unknown>)[kIds] as EntityId[];
    const newIds: EntityId[] = [];
    const newMap: Record<EntityId, E> = { ...currentMap };
    for (const e of entities) {
      const id = cfg.selectId(e);
      if (id in newMap) continue;
      newIds.push(id);
      newMap[id] = e;
    }
    if (newIds.length === 0) return {};
    return {
      [kIds]: [...currentIds, ...newIds],
      [kMap]: newMap,
    } as Partial<CollectionSlice<E, C>>;
  };
}
