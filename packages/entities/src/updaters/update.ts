import { mapKey } from '../internal/keys';
import type {
  CollectionSlice,
  CollectionUpdater,
  EntityChanges,
  EntityConfig,
  EntityId,
} from '../types';

function applyChanges<E>(entity: E, changes: EntityChanges<E>): E {
  const patch = typeof changes === 'function' ? changes(entity) : changes;
  return { ...entity, ...patch };
}

export function updateEntity<E, C extends string>(
  update: { id: EntityId; changes: EntityChanges<E> },
  cfg: EntityConfig<E, C>,
): CollectionUpdater<E, C> {
  const kMap = mapKey(cfg.collection);

  return (state) => {
    const currentMap = (state as Record<string, unknown>)[kMap] as Record<EntityId, E>;
    const current = currentMap[update.id];
    if (current === undefined) return {};
    return {
      [kMap]: { ...currentMap, [update.id]: applyChanges(current, update.changes) },
    } as Partial<CollectionSlice<E, C>>;
  };
}

export function updateEntities<E, C extends string>(
  updates: ReadonlyArray<{ id: EntityId; changes: EntityChanges<E> }>,
  cfg: EntityConfig<E, C>,
): CollectionUpdater<E, C> {
  const kMap = mapKey(cfg.collection);

  return (state) => {
    if (updates.length === 0) return {};
    const currentMap = (state as Record<string, unknown>)[kMap] as Record<EntityId, E>;
    let changed = false;
    const nextMap: Record<EntityId, E> = { ...currentMap };
    for (const u of updates) {
      const current = nextMap[u.id];
      if (current === undefined) continue;
      nextMap[u.id] = applyChanges(current, u.changes);
      changed = true;
    }
    if (!changed) return {};
    return { [kMap]: nextMap } as Partial<CollectionSlice<E, C>>;
  };
}

export function updateAllEntities<E, C extends string>(
  changes: EntityChanges<E>,
  cfg: EntityConfig<E, C>,
): CollectionUpdater<E, C> {
  const kMap = mapKey(cfg.collection);

  return (state) => {
    const currentMap = (state as Record<string, unknown>)[kMap] as Record<EntityId, E>;
    const ids = Object.keys(currentMap);
    if (ids.length === 0) return {};
    const nextMap: Record<EntityId, E> = {};
    for (const id of ids) {
      const current = currentMap[id] as E;
      nextMap[id] = applyChanges(current, changes);
    }
    return { [kMap]: nextMap } as Partial<CollectionSlice<E, C>>;
  };
}
