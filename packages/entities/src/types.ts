/**
 * Allowed entity identifier type. Use `number` for sequential ids or `string`
 * for UUIDs / slugs.
 */
export type EntityId = string | number;

/**
 * Typed configuration shared by {@link withEntities} and every updater.
 *
 * Build via {@link entityConfig} — never assemble by hand. The literal
 * `collection` is what makes the keys exposed on the store (`<C>Ids`,
 * `<C>EntityMap`, `<C>Entities`) typed and unique per collection.
 *
 * When `sortComparer` is provided, `<C>Entities` returns the array sorted
 * by the comparator on every read (memoized via `computed`). Internal
 * `ids` order is preserved — only the derived view is sorted.
 */
export interface EntityConfig<E, C extends string = ''> {
  readonly collection: C;
  readonly selectId: (entity: E) => EntityId;
  readonly sortComparer?: (a: E, b: E) => number;
}

/**
 * Derive the `ids` key for a collection: `'ids'` when `C` is empty, otherwise
 * `${C}Ids` (e.g. `'todosIds'`).
 */
export type IdsKey<C extends string> = C extends '' ? 'ids' : `${C}Ids`;

/**
 * Derive the `entityMap` key for a collection: `'entityMap'` when `C` is
 * empty, otherwise `${C}EntityMap` (e.g. `'todosEntityMap'`).
 */
export type MapKey<C extends string> = C extends '' ? 'entityMap' : `${C}EntityMap`;

/**
 * Derive the `entities` key for a collection: `'entities'` when `C` is
 * empty, otherwise `${C}Entities` (e.g. `'todosEntities'`).
 */
export type EntitiesKey<C extends string> = C extends '' ? 'entities' : `${C}Entities`;

/**
 * Plain-state shape of a single collection — `ids` array + `entityMap`
 * lookup. Used as the input/output type of {@link CollectionUpdater}.
 */
export type CollectionSlice<E, C extends string> = { [K in IdsKey<C>]: EntityId[] } & {
  [K in MapKey<C>]: Record<EntityId, E>;
};

/**
 * Signature of every entity updater returned by `addEntity`, `removeEntity`,
 * etc. Pass these to {@link patchState}.
 */
export type CollectionUpdater<E, C extends string> = (
  state: CollectionSlice<E, C>,
) => Partial<CollectionSlice<E, C>>;

/**
 * Description of how to mutate one entity: a partial object (shallow merge)
 * or a function `(entity) => partial`.
 */
export type EntityChanges<E> = Partial<E> | ((entity: E) => Partial<E>);
