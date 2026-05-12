import { patchState, signalStore } from '@fluch/signal-store';
import { describe, expect, it } from 'vitest';
import { entityConfig } from '../entity-config';
import { withEntities } from '../with-entities';
import { addEntities } from './add';
import { updateAllEntities, updateEntities, updateEntity } from './update';

type Todo = { id: string; title: string; done: boolean };

const cfg = entityConfig<Todo>();
const seed = (): ReturnType<typeof setupStore> => setupStore();
function setupStore() {
  const store = signalStore(withEntities(cfg));
  patchState(
    store,
    addEntities(
      [
        { id: 'a', title: 'a', done: false },
        { id: 'b', title: 'b', done: false },
        { id: 'c', title: 'c', done: true },
      ],
      cfg,
    ),
  );
  return store;
}

describe('updateEntity', () => {
  it('merges a Partial<E> patch', () => {
    const store = seed();
    patchState(store, updateEntity({ id: 'a', changes: { title: 'A!' } }, cfg));

    expect(store.entityMap.value.a).toEqual({ id: 'a', title: 'A!', done: false });
    // Other entities untouched
    expect(store.entityMap.value.b).toEqual({ id: 'b', title: 'b', done: false });
  });

  it('accepts a function that derives changes from the current entity', () => {
    const store = seed();
    patchState(store, updateEntity({ id: 'a', changes: (t) => ({ done: !t.done }) }, cfg));

    expect(store.entityMap.value.a.done).toBe(true);
  });

  it('is a silent no-op when the id is unknown', () => {
    const store = seed();
    const mapBefore = store.entityMap.value;
    patchState(store, updateEntity({ id: 'missing', changes: { title: 'x' } }, cfg));

    expect(store.entityMap.value).toBe(mapBefore);
  });

  it('does not reorder ids', () => {
    const store = seed();
    patchState(store, updateEntity({ id: 'a', changes: { title: 'A!' } }, cfg));

    expect(store.ids.value).toEqual(['a', 'b', 'c']);
  });
});

describe('updateEntities', () => {
  it('applies multiple patches in one mutation', () => {
    const store = seed();
    patchState(
      store,
      updateEntities(
        [
          { id: 'a', changes: { done: true } },
          { id: 'b', changes: (t) => ({ title: t.title.toUpperCase() }) },
        ],
        cfg,
      ),
    );

    expect(store.entityMap.value.a.done).toBe(true);
    expect(store.entityMap.value.b.title).toBe('B');
  });

  it('ignores patches targeting unknown ids', () => {
    const store = seed();
    patchState(
      store,
      updateEntities(
        [
          { id: 'a', changes: { done: true } },
          { id: 'missing', changes: { title: 'x' } },
        ],
        cfg,
      ),
    );

    expect(store.entityMap.value.a.done).toBe(true);
    expect('missing' in store.entityMap.value).toBe(false);
  });

  it('is a no-op when all ids are unknown', () => {
    const store = seed();
    const before = store.entityMap.value;
    patchState(store, updateEntities([{ id: 'zzz', changes: { title: 'x' } }], cfg));

    expect(store.entityMap.value).toBe(before);
  });
});

describe('updateAllEntities', () => {
  it('applies the same patch to every entity', () => {
    const store = seed();
    patchState(store, updateAllEntities({ done: true }, cfg));

    expect(store.entityMap.value.a.done).toBe(true);
    expect(store.entityMap.value.b.done).toBe(true);
    expect(store.entityMap.value.c.done).toBe(true);
  });

  it('accepts a function patch that sees each entity', () => {
    const store = seed();
    patchState(
      store,
      updateAllEntities((t) => ({ title: `${t.title}!` }), cfg),
    );

    expect(store.entityMap.value.a.title).toBe('a!');
    expect(store.entityMap.value.b.title).toBe('b!');
    expect(store.entityMap.value.c.title).toBe('c!');
  });

  it('is a no-op on an empty collection', () => {
    const store = signalStore(withEntities(cfg));
    const before = store.entityMap.value;
    patchState(store, updateAllEntities({ done: true }, cfg));

    expect(store.entityMap.value).toBe(before);
  });
});
