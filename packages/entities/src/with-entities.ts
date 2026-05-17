import { type SignalStoreFeature, withState } from '@fluch/signal-store';
import { computed, type ReadonlySignal } from '@preact/signals-core';
import { entitiesKey, idsKey, mapKey } from './internal/keys';
import type { EntitiesKey, EntityConfig, EntityId, IdsKey, MapKey } from './types';

/**
 * Shape of the keys {@link withEntities} contributes to the store.
 *
 * For an `''` collection it expands to `{ ids, entityMap, entities }`; for a
 * `'todos'` collection it expands to
 * `{ todosIds, todosEntityMap, todosEntities }`.
 */
export type EntityFeatureOutput<E, C extends string> = {
  [K in IdsKey<C>]: ReadonlySignal<EntityId[]>;
} & {
  [K in MapKey<C>]: ReadonlySignal<Record<EntityId, E>>;
} & {
  [K in EntitiesKey<C>]: ReadonlySignal<E[]>;
};

// biome-ignore lint/complexity/noBannedTypes: identity element for feature composition (matches core's EmptySlot)
type EmptySlot = {};

/**
 * Add a normalized collection of entities to a store.
 *
 * Exposes three signals derived from the config's `collection` prefix:
 * - `<prefix>Ids` — ordered list of entity ids,
 * - `<prefix>EntityMap` — `id → entity` map,
 * - `<prefix>Entities` — computed array `ids.map(id => map[id])`. Insertion
 *   order by default; if `config.sortComparer` is set, the array is sorted
 *   by the comparator on every read (memoized via `computed`). Internal
 *   `<prefix>Ids` order is preserved — only the derived view is sorted.
 *
 * Mutate the collection via the updater functions (`addEntity`,
 * `removeEntity`, etc.) passed to {@link patchState}. Compose multiple
 * `withEntities` calls in the same store to manage several collections at
 * once — use distinct `collection` prefixes to avoid key collisions.
 *
 * @param config — typed config built with {@link entityConfig}.
 * @example
 * ```ts
 * import { signalStore } from '@fluch/signal-store';
 * import { entityConfig, withEntities } from '@fluch/signal-store-entities';
 *
 * type Todo = { id: string; title: string };
 *
 * const todosCfg = entityConfig<Todo>({ collection: 'todos' });
 * const store = signalStore(withEntities(todosCfg));
 *
 * store.todosIds.value;      // []
 * store.todosEntityMap.value; // {}
 * store.todosEntities.value;  // []
 * ```
 */
export function withEntities<E, C extends string = ''>(
  config: EntityConfig<E, C>,
): SignalStoreFeature<EmptySlot, EntityFeatureOutput<E, C>> {
  const kIds = idsKey(config.collection);
  const kMap = mapKey(config.collection);
  const kEnts = entitiesKey(config.collection);
  const cmp = config.sortComparer;

  return (input) => {
    const stateSignals = withState({
      [kIds]: [] as EntityId[],
      [kMap]: {} as Record<EntityId, E>,
    })(input) as Record<string, ReadonlySignal<unknown>>;

    const idsSig = stateSignals[kIds] as ReadonlySignal<EntityId[]>;
    const mapSig = stateSignals[kMap] as ReadonlySignal<Record<EntityId, E>>;
    const entitiesSig: ReadonlySignal<E[]> = computed(() => {
      const arr = idsSig.value.map((id) => mapSig.value[id] as E);
      if (cmp) arr.sort(cmp);
      return arr;
    });

    return { ...stateSignals, [kEnts]: entitiesSig } as unknown as EntityFeatureOutput<E, C>;
  };
}
