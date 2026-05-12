import { patchState, signalStore } from '@fluch/signal-store';
import { describe, expect, it } from 'vitest';
import { entityConfig } from '../entity-config';
import { withEntities } from '../with-entities';
import { addEntity } from './add';
import { setAllEntities, setEntities, setEntity } from './set';

type Todo = { id: string; title: string };

const cfg = entityConfig<Todo>();
const makeStore = () => signalStore(withEntities(cfg));

describe('setEntity', () => {
  it('adds the entity if absent', () => {
    const store = makeStore();
    patchState(store, setEntity({ id: 'a', title: 'first' }, cfg));

    expect(store.ids.value).toEqual(['a']);
    expect(store.entityMap.value.a).toEqual({ id: 'a', title: 'first' });
  });

  it('REPLACES an existing entity (unlike addEntity)', () => {
    const store = makeStore();
    patchState(store, addEntity({ id: 'a', title: 'old' }, cfg));
    patchState(store, setEntity({ id: 'a', title: 'new' }, cfg));

    expect(store.ids.value).toEqual(['a']);
    expect(store.entityMap.value.a).toEqual({ id: 'a', title: 'new' });
  });
});

describe('setEntities', () => {
  it('upserts an array of entities', () => {
    const store = makeStore();
    patchState(store, addEntity({ id: 'a', title: 'a-old' }, cfg));
    patchState(
      store,
      setEntities(
        [
          { id: 'a', title: 'a-new' },
          { id: 'b', title: 'b' },
        ],
        cfg,
      ),
    );

    expect(store.ids.value).toEqual(['a', 'b']);
    expect(store.entityMap.value.a).toEqual({ id: 'a', title: 'a-new' });
    expect(store.entityMap.value.b).toEqual({ id: 'b', title: 'b' });
  });

  it('is a no-op for empty input', () => {
    const store = makeStore();
    patchState(store, addEntity({ id: 'a', title: 'a' }, cfg));
    const ids = store.ids.value;
    patchState(store, setEntities([], cfg));
    expect(store.ids.value).toBe(ids);
  });
});

describe('setAllEntities', () => {
  it('REPLACES the entire collection (drops anything not in the input)', () => {
    const store = makeStore();
    patchState(
      store,
      setEntities(
        [
          { id: 'a', title: 'a' },
          { id: 'b', title: 'b' },
        ],
        cfg,
      ),
    );

    patchState(store, setAllEntities([{ id: 'c', title: 'c' }], cfg));

    expect(store.ids.value).toEqual(['c']);
    expect(store.entityMap.value).toEqual({ c: { id: 'c', title: 'c' } });
  });

  it('clears the collection with an empty array', () => {
    const store = makeStore();
    patchState(store, addEntity({ id: 'a', title: 'a' }, cfg));
    patchState(store, setAllEntities([], cfg));

    expect(store.ids.value).toEqual([]);
    expect(store.entityMap.value).toEqual({});
    expect(store.entities.value).toEqual([]);
  });
});
