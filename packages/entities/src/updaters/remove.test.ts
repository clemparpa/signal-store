import { patchState, signalStore } from '@fluch/signal-store';
import { describe, expect, it } from 'vitest';
import { entityConfig } from '../entity-config';
import { withEntities } from '../with-entities';
import { addEntities } from './add';
import { removeAllEntities, removeEntities, removeEntity } from './remove';

type Todo = { id: string; title: string; done: boolean };

const cfg = entityConfig<Todo>();
function seed() {
  const store = signalStore(withEntities(cfg));
  patchState(
    store,
    addEntities(
      [
        { id: 'a', title: 'a', done: false },
        { id: 'b', title: 'b', done: true },
        { id: 'c', title: 'c', done: false },
      ],
      cfg,
    ),
  );
  return store;
}

describe('removeEntity', () => {
  it('removes by id from both ids and entityMap', () => {
    const store = seed();
    patchState(store, removeEntity('b', cfg));

    expect(store.ids.value).toEqual(['a', 'c']);
    expect('b' in store.entityMap.value).toBe(false);
    expect(store.entities.value.map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('is a no-op for unknown ids', () => {
    const store = seed();
    const idsBefore = store.ids.value;
    const mapBefore = store.entityMap.value;
    patchState(store, removeEntity('missing', cfg));

    expect(store.ids.value).toBe(idsBefore);
    expect(store.entityMap.value).toBe(mapBefore);
  });
});

describe('removeEntities', () => {
  it('removes by array of ids', () => {
    const store = seed();
    patchState(store, removeEntities(['a', 'c'], cfg));

    expect(store.ids.value).toEqual(['b']);
    expect(Object.keys(store.entityMap.value)).toEqual(['b']);
  });

  it('ignores unknown ids', () => {
    const store = seed();
    patchState(store, removeEntities(['a', 'missing'], cfg));

    expect(store.ids.value).toEqual(['b', 'c']);
    expect('a' in store.entityMap.value).toBe(false);
  });

  it('is a no-op when all ids are unknown', () => {
    const store = seed();
    const idsBefore = store.ids.value;
    patchState(store, removeEntities(['nope', 'gone'], cfg));
    expect(store.ids.value).toBe(idsBefore);
  });

  it('is a no-op for an empty id array', () => {
    const store = seed();
    const idsBefore = store.ids.value;
    patchState(store, removeEntities([], cfg));
    expect(store.ids.value).toBe(idsBefore);
  });
});

describe('removeAllEntities', () => {
  it('clears ids and entityMap', () => {
    const store = seed();
    patchState(store, removeAllEntities(cfg));

    expect(store.ids.value).toEqual([]);
    expect(store.entityMap.value).toEqual({});
    expect(store.entities.value).toEqual([]);
  });
});
