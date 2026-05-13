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

/**
 * Build an updater that shallow-merges changes into a single entity.
 *
 * `changes` is either a partial object or a function `(entity) => partial`.
 * If the id isn't in the collection, the update is a no-op (entities are
 * never created here — use {@link setEntity} for upsert semantics).
 *
 * @example
 * ```ts
 * import { patchState } from '@fluch/signal-store';
 * import { updateEntity } from '@fluch/signal-store-entities';
 *
 * // Partial-object form
 * patchState(store, updateEntity({ id: '1', changes: { done: true } }, todosCfg));
 *
 * // Updater-function form
 * patchState(store, updateEntity(
 *   { id: '1', changes: (t) => ({ done: !t.done }) },
 *   todosCfg,
 * ));
 * ```
 */
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

/**
 * Build an updater that shallow-merges changes into many entities at once.
 *
 * Each entry targets one id; missing ids are skipped silently. Empty input
 * and "no entry actually changed" are both no-ops.
 *
 * @example
 * ```ts
 * import { patchState } from '@fluch/signal-store';
 * import { updateEntities } from '@fluch/signal-store-entities';
 *
 * patchState(store, updateEntities([
 *   { id: '1', changes: { done: true } },
 *   { id: '2', changes: { done: true } },
 * ], todosCfg));
 * ```
 */
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

/**
 * Build an updater that applies the same change to every entity in the
 * collection.
 *
 * `changes` is either a partial object or a function `(entity) => partial`.
 * Empty collection → no-op.
 *
 * @example
 * ```ts
 * import { patchState } from '@fluch/signal-store';
 * import { updateAllEntities } from '@fluch/signal-store-entities';
 *
 * // Mark every todo as done
 * patchState(store, updateAllEntities({ done: true }, todosCfg));
 * ```
 */
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
