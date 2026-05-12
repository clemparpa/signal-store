import { patchState, signalStore } from '@fluch/signal-store';
import { describe, expect, it } from 'vitest';
import { entityConfig } from './entity-config';
import { withEntities } from './with-entities';

type Todo = { id: string; title: string; done: boolean };
type User = { uuid: string; name: string };

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
});
