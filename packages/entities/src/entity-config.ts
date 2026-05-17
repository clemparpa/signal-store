import type { EntityConfig, EntityId } from './types';

const defaultSelectId = <E>(entity: E): EntityId => (entity as { id: EntityId }).id;

/**
 * Build the typed config object shared by {@link withEntities} and every
 * updater (`addEntity`, `removeEntity`, …).
 *
 * The `collection` prefix decides the keys exposed on the store:
 * - `''` (default, mono-collection) → `ids`, `entityMap`, `entities`
 * - `'todos'` (multi-collection) → `todosIds`, `todosEntityMap`, `todosEntities`
 *
 * `selectId` extracts the entity's unique id; defaults to `entity.id`.
 * `sortComparer` (optional) makes `<C>Entities` return a sorted view — the
 * comparator runs once per mutation, memoized by the underlying `computed`.
 * Internal `<C>Ids` order is unchanged, so updaters and persistence are not
 * affected. Capture the returned config in a top-level constant — passing it
 * back to the updaters preserves the literal-type for `collection`, which is
 * what powers the typed keys above.
 *
 * @param opts — optional `collection` prefix, custom `selectId`, and
 *   `sortComparer`.
 * @returns the entity config object.
 * @example
 * ```ts
 * import { entityConfig, withEntities, addEntity } from '@fluch/signal-store-entities';
 * import { signalStore, withMethods, patchState } from '@fluch/signal-store';
 *
 * type Todo = { id: string; title: string; dueDate: number };
 *
 * const todosCfg = entityConfig<Todo>({
 *   collection: 'todos',
 *   sortComparer: (a, b) => a.dueDate - b.dueDate,
 * });
 *
 * const store = signalStore(
 *   withEntities(todosCfg),
 *   withMethods((s) => ({
 *     add: (t: Todo) => patchState(s, addEntity(t, todosCfg)),
 *   })),
 * );
 *
 * store.todosEntities.value; // sorted by dueDate
 * ```
 */
export function entityConfig<E, C extends string = ''>(opts?: {
  collection?: C;
  selectId?: (entity: E) => EntityId;
  sortComparer?: (a: E, b: E) => number;
}): EntityConfig<E, C> {
  return {
    collection: (opts?.collection ?? '') as C,
    selectId: opts?.selectId ?? defaultSelectId,
    ...(opts?.sortComparer !== undefined ? { sortComparer: opts.sortComparer } : {}),
  };
}
