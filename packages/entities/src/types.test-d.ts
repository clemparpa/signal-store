import { patchState, signalStore } from '@fluch/signal-store';
import type { ReadonlySignal } from '@preact/signals-core';
import { describe, expectTypeOf, it } from 'vitest';
import { entityConfig } from './entity-config';
import type { EntityId } from './types';
import { addEntities, addEntity } from './updaters/add';
import { setEntity } from './updaters/set';
import { updateEntity } from './updaters/update';
import { withEntities } from './with-entities';

type Todo = { id: string; title: string; done: boolean };
type User = { uuid: string; name: string };

describe('entities — type-level', () => {
  it('infers mono-collection signals without manual annotations', () => {
    const cfg = entityConfig<Todo>();
    const store = signalStore(withEntities(cfg));

    expectTypeOf(store.ids).toEqualTypeOf<ReadonlySignal<EntityId[]>>();
    expectTypeOf(store.entityMap).toEqualTypeOf<ReadonlySignal<Record<EntityId, Todo>>>();
    expectTypeOf(store.entities).toEqualTypeOf<ReadonlySignal<Todo[]>>();
  });

  it('prefixes signal names with the collection (multi-collection)', () => {
    const cfg = entityConfig<User, 'users'>({ collection: 'users', selectId: (u) => u.uuid });
    const store = signalStore(withEntities(cfg));

    expectTypeOf(store.usersIds).toEqualTypeOf<ReadonlySignal<EntityId[]>>();
    expectTypeOf(store.usersEntityMap).toEqualTypeOf<ReadonlySignal<Record<EntityId, User>>>();
    expectTypeOf(store.usersEntities).toEqualTypeOf<ReadonlySignal<User[]>>();
  });

  it('rejects an entity that does not match the config', () => {
    const todosCfg = entityConfig<Todo>();
    const store = signalStore(withEntities(todosCfg));

    // @ts-expect-error — wrong entity type
    addEntity({ uuid: 'x', name: 'y' }, todosCfg);

    // sanity: correct usage type-checks
    patchState(store, addEntity({ id: 'a', title: 'a', done: false }, todosCfg));
    patchState(
      store,
      addEntities(
        [
          { id: 'a', title: 'a', done: false },
          { id: 'b', title: 'b', done: true },
        ],
        todosCfg,
      ),
    );
    patchState(store, setEntity({ id: 'a', title: 'a', done: false }, todosCfg));
    patchState(store, updateEntity({ id: 'a', changes: { done: true } }, todosCfg));
  });
});
