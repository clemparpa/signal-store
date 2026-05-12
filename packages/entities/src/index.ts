export { entityConfig } from './entity-config';
export type {
  CollectionSlice,
  CollectionUpdater,
  EntitiesKey,
  EntityChanges,
  EntityConfig,
  EntityId,
  IdsKey,
  MapKey,
} from './types';
export { addEntities, addEntity } from './updaters/add';
export { removeAllEntities, removeEntities, removeEntity } from './updaters/remove';
export { setAllEntities, setEntities, setEntity } from './updaters/set';
export { updateAllEntities, updateEntities, updateEntity } from './updaters/update';
export { type EntityFeatureOutput, withEntities } from './with-entities';
