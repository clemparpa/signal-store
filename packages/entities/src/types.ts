export type EntityId = string | number;

export interface EntityConfig<E, C extends string = ''> {
  readonly collection: C;
  readonly selectId: (entity: E) => EntityId;
}

export type IdsKey<C extends string> = C extends '' ? 'ids' : `${C}Ids`;
export type MapKey<C extends string> = C extends '' ? 'entityMap' : `${C}EntityMap`;
export type EntitiesKey<C extends string> = C extends '' ? 'entities' : `${C}Entities`;

export type CollectionSlice<E, C extends string> = { [K in IdsKey<C>]: EntityId[] } & {
  [K in MapKey<C>]: Record<EntityId, E>;
};

export type CollectionUpdater<E, C extends string> = (
  state: CollectionSlice<E, C>,
) => Partial<CollectionSlice<E, C>>;

export type EntityChanges<E> = Partial<E> | ((entity: E) => Partial<E>);
