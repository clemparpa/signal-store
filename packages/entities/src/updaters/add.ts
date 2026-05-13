import { idsKey, mapKey } from '../internal/keys';
import type { CollectionSlice, CollectionUpdater, EntityConfig, EntityId } from '../types';

/**
 * Build an updater that appends a single entity to the collection.
 *
 * If an entity with the same id already exists, the update is a no-op
 * (existing entities are preserved — use {@link setEntity} to overwrite).
 * Pass the returned updater to {@link patchState}.
 *
 * @example
 * ```ts
 * import { patchState } from '@fluch/signal-store';
 * import { addEntity } from '@fluch/signal-store-entities';
 *
 * patchState(store, addEntity({ id: '1', title: 'milk' }, todosCfg));
 * ```
 */
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

/**
 * Build an updater that appends many entities to the collection in one shot.
 *
 * Entities whose id is already present are skipped silently. Ordering of the
 * `ids` array reflects insertion order. Empty input → no-op.
 *
 * @example
 * ```ts
 * import { patchState } from '@fluch/signal-store';
 * import { addEntities } from '@fluch/signal-store-entities';
 *
 * patchState(store, addEntities([
 *   { id: '1', title: 'milk' },
 *   { id: '2', title: 'bread' },
 * ], todosCfg));
 * ```
 */
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
