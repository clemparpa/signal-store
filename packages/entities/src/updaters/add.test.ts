import { patchState, signalStore } from '@fluch/signal-store';
import { describe, expect, it } from 'vitest';
import { entityConfig } from '../entity-config';
import { withEntities } from '../with-entities';
import { addEntities, addEntity } from './add';

type Todo = { id: string; title: string };

const cfg = entityConfig<Todo>();

const makeStore = () => signalStore(withEntities(cfg));

describe('addEntity', () => {
  it('appends a new entity to ids and entityMap', () => {
    const store = makeStore();
    patchState(store, addEntity({ id: 'a', title: 'first' }, cfg));

    expect(store.ids.value).toEqual(['a']);
    expect(store.entityMap.value).toEqual({ a: { id: 'a', title: 'first' } });
    expect(store.entities.value).toEqual([{ id: 'a', title: 'first' }]);
  });

  it('is a no-op when the id already exists (does not replace)', () => {
    const store = makeStore();
    patchState(store, addEntity({ id: 'a', title: 'first' }, cfg));
    patchState(store, addEntity({ id: 'a', title: 'replaced' }, cfg));

    expect(store.ids.value).toEqual(['a']);
    expect(store.entityMap.value).toEqual({ a: { id: 'a', title: 'first' } });
  });

  it('preserves insertion order', () => {
    const store = makeStore();
    patchState(store, addEntity({ id: 'a', title: 'a' }, cfg));
    patchState(store, addEntity({ id: 'c', title: 'c' }, cfg));
    patchState(store, addEntity({ id: 'b', title: 'b' }, cfg));

    expect(store.ids.value).toEqual(['a', 'c', 'b']);
  });

  it('works with multi-collection prefix', () => {
    const usersCfg = entityConfig<{ uuid: string; name: string }, 'users'>({
      collection: 'users',
      selectId: (u) => u.uuid,
    });
    const store = signalStore(withEntities(usersCfg));
    patchState(store, addEntity({ uuid: 'u1', name: 'alice' }, usersCfg));

    expect(store.usersIds.value).toEqual(['u1']);
    expect(store.usersEntityMap.value).toEqual({ u1: { uuid: 'u1', name: 'alice' } });
  });

  it('handles falsy-but-valid ids (0 and "")', () => {
    const store = signalStore(withEntities(entityConfig<{ id: number; n: string }>()));
    patchState(store, addEntity({ id: 0, n: 'zero' }, entityConfig<{ id: number; n: string }>()));
    expect(store.ids.value).toEqual([0]);
    expect(store.entityMap.value).toEqual({ 0: { id: 0, n: 'zero' } });

    // Re-adding id=0 → no-op (would fail if implementation used truthy check)
    patchState(
      store,
      addEntity({ id: 0, n: 'replaced' }, entityConfig<{ id: number; n: string }>()),
    );
    expect(store.entityMap.value).toEqual({ 0: { id: 0, n: 'zero' } });
  });
});

describe('addEntities', () => {
  it('adds an array of entities', () => {
    const store = makeStore();
    patchState(
      store,
      addEntities(
        [
          { id: 'a', title: 'a' },
          { id: 'b', title: 'b' },
        ],
        cfg,
      ),
    );

    expect(store.ids.value).toEqual(['a', 'b']);
    expect(store.entities.value).toHaveLength(2);
  });

  it('deduplicates against existing ids (no-op for duplicates)', () => {
    const store = makeStore();
    patchState(store, addEntity({ id: 'a', title: 'original' }, cfg));
    patchState(
      store,
      addEntities(
        [
          { id: 'a', title: 'changed' },
          { id: 'b', title: 'new' },
        ],
        cfg,
      ),
    );

    expect(store.ids.value).toEqual(['a', 'b']);
    expect(store.entityMap.value.a).toEqual({ id: 'a', title: 'original' });
    expect(store.entityMap.value.b).toEqual({ id: 'b', title: 'new' });
  });

  it('deduplicates within the input array (keeps the first)', () => {
    const store = makeStore();
    patchState(
      store,
      addEntities(
        [
          { id: 'a', title: 'first' },
          { id: 'a', title: 'second' },
        ],
        cfg,
      ),
    );

    expect(store.ids.value).toEqual(['a']);
    expect(store.entityMap.value.a).toEqual({ id: 'a', title: 'first' });
  });

  it('is a no-op with an empty array', () => {
    const store = makeStore();
    patchState(store, addEntity({ id: 'a', title: 'a' }, cfg));
    const idsBefore = store.ids.value;
    const mapBefore = store.entityMap.value;
    patchState(store, addEntities([], cfg));

    expect(store.ids.value).toBe(idsBefore);
    expect(store.entityMap.value).toBe(mapBefore);
  });
});
