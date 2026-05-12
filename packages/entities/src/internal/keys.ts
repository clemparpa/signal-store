export const idsKey = (collection: string): string =>
  collection === '' ? 'ids' : `${collection}Ids`;

export const mapKey = (collection: string): string =>
  collection === '' ? 'entityMap' : `${collection}EntityMap`;

export const entitiesKey = (collection: string): string =>
  collection === '' ? 'entities' : `${collection}Entities`;
