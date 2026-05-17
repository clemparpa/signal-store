import { patchState, signalStore } from '@fluch/signal-store';
import { describe, expect, it } from 'vitest';
import { entityConfig } from './entity-config';
import { addEntity } from './updaters/add';
import { updateEntity } from './updaters/update';
import { withEntities } from './with-entities';

type Todo = { id: string; title: string; done: boolean };
type User = { uuid: string; name: string };
type Task = { id: string; priority: number; title: string };

describe('withEntities', () => {
  it('adds ids, entityMap and entities to the store (mono-collection)', () => {
    const cfg = entityConfig<Todo>();
    const store = signalStore(withEntities(cfg));

    expect(store.ids.value).toEqual([]);
    expect(store.entityMap.value).toEqual({});
    expect(store.entities.value).toEqual([]);
  });

  it('prefixes keys with the collection name (multi-collection)', () => {
    const cfg = entityConfig<User, 'users'>({ collection: 'users', selectId: (u) => u.uuid });
    const store = signalStore(withEntities(cfg));

    expect(store.usersIds.value).toEqual([]);
    expect(store.usersEntityMap.value).toEqual({});
    expect(store.usersEntities.value).toEqual([]);
  });

  it('lets two collections coexist in the same store', () => {
    const todosCfg = entityConfig<Todo>();
    const usersCfg = entityConfig<User, 'users'>({
      collection: 'users',
      selectId: (u) => u.uuid,
    });

    const store = signalStore(withEntities(todosCfg), withEntities(usersCfg));

    expect(store.ids.value).toEqual([]);
    expect(store.usersIds.value).toEqual([]);
    expect(store.entityMap.value).toEqual({});
    expect(store.usersEntityMap.value).toEqual({});
  });

  it('throws on duplicate collection (delegates to signalStore key-collision check)', () => {
    const cfg = entityConfig<Todo>();
    expect(() => signalStore(withEntities(cfg), withEntities(cfg))).toThrow(/duplicate/);
  });

  it('keeps entities in sync with ids/entityMap when state mutates', () => {
    const cfg = entityConfig<Todo>();
    const store = signalStore(withEntities(cfg));

    patchState(store, {
      ids: ['a', 'b'],
      entityMap: {
        a: { id: 'a', title: 'first', done: false },
        b: { id: 'b', title: 'second', done: true },
      },
    });

    expect(store.entities.value).toEqual([
      { id: 'a', title: 'first', done: false },
      { id: 'b', title: 'second', done: true },
    ]);
  });

  it('throws if used outside signalStore', () => {
    const cfg = entityConfig<Todo>();
    const feature = withEntities(cfg);
    expect(() => feature({})).toThrow(/signalStore/);
  });

  describe('sortComparer', () => {
    it('preserves insertion order when no sortComparer is set', () => {
      const cfg = entityConfig<Task>();
      const store = signalStore(withEntities(cfg));

      patchState(store, addEntity({ id: 'c', priority: 3, title: 'c' }, cfg));
      patchState(store, addEntity({ id: 'a', priority: 1, title: 'a' }, cfg));
      patchState(store, addEntity({ id: 'b', priority: 2, title: 'b' }, cfg));

      expect(store.entities.value.map((t) => t.id)).toEqual(['c', 'a', 'b']);
    });

    it('returns entities sorted by the comparator on read', () => {
      const cfg = entityConfig<Task>({ sortComparer: (a, b) => a.priority - b.priority });
      const store = signalStore(withEntities(cfg));

      patchState(store, addEntity({ id: 'c', priority: 3, title: 'c' }, cfg));
      patchState(store, addEntity({ id: 'a', priority: 1, title: 'a' }, cfg));
      patchState(store, addEntity({ id: 'b', priority: 2, title: 'b' }, cfg));

      expect(store.entities.value.map((t) => t.priority)).toEqual([1, 2, 3]);
      // internal ids order is untouched
      expect(store.ids.value).toEqual(['c', 'a', 'b']);
    });

    it('re-sorts when a new entity is inserted', () => {
      const cfg = entityConfig<Task>({ sortComparer: (a, b) => a.priority - b.priority });
      const store = signalStore(withEntities(cfg));

      patchState(store, addEntity({ id: 'a', priority: 1, title: 'a' }, cfg));
      patchState(store, addEntity({ id: 'c', priority: 3, title: 'c' }, cfg));
      expect(store.entities.value.map((t) => t.priority)).toEqual([1, 3]);

      patchState(store, addEntity({ id: 'b', priority: 2, title: 'b' }, cfg));
      expect(store.entities.value.map((t) => t.priority)).toEqual([1, 2, 3]);
    });

    it('re-sorts when an entity update mutates the sort key', () => {
      const cfg = entityConfig<Task>({ sortComparer: (a, b) => a.priority - b.priority });
      const store = signalStore(withEntities(cfg));

      patchState(store, addEntity({ id: 'a', priority: 1, title: 'a' }, cfg));
      patchState(store, addEntity({ id: 'b', priority: 2, title: 'b' }, cfg));
      patchState(store, addEntity({ id: 'c', priority: 3, title: 'c' }, cfg));
      expect(store.entities.value.map((t) => t.id)).toEqual(['a', 'b', 'c']);

      patchState(store, updateEntity({ id: 'a', changes: { priority: 99 } }, cfg));
      expect(store.entities.value.map((t) => t.id)).toEqual(['b', 'c', 'a']);
    });
  });
});
