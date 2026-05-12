import { patchState, signalStore, withComputed, withMethods } from '@fluch/signal-store';
import { computed, effect } from '@preact/signals-core';
import { describe, expect, it } from 'vitest';
import { entityConfig } from './entity-config';
import { addEntities, addEntity } from './updaters/add';
import { removeEntity } from './updaters/remove';
import { setAllEntities } from './updaters/set';
import { updateEntity } from './updaters/update';
import { withEntities } from './with-entities';

type Todo = { id: string; title: string; done: boolean };
type User = { uuid: string; name: string };

describe('entities integration', () => {
  it('runs the spec §6 scenario end-to-end (todos + users in one store)', () => {
    const todosCfg = entityConfig<Todo>();
    const usersCfg = entityConfig<User, 'users'>({
      collection: 'users',
      selectId: (u) => u.uuid,
    });

    const store = signalStore(
      withEntities(todosCfg),
      withEntities(usersCfg),
      withComputed(({ entities }) => ({
        pendingTodos: computed(() => entities.value.filter((t) => !t.done)),
      })),
      withMethods((s) => ({
        addTodo: (t: Todo) => patchState(s, addEntity(t, todosCfg)),
        toggle: (id: string) =>
          patchState(s, updateEntity({ id, changes: (t) => ({ done: !t.done }) }, todosCfg)),
        remove: (id: string) => patchState(s, removeEntity(id, todosCfg)),
        loadAll: (todos: Todo[]) => patchState(s, setAllEntities(todos, todosCfg)),
        addUser: (u: User) => patchState(s, addEntity(u, usersCfg)),
      })),
    );

    store.addTodo({ id: 't1', title: 'first', done: false });
    store.addTodo({ id: 't2', title: 'second', done: false });
    store.addUser({ uuid: 'u1', name: 'alice' });

    expect(store.entities.value.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(store.usersEntities.value).toEqual([{ uuid: 'u1', name: 'alice' }]);
    expect(store.pendingTodos.value).toHaveLength(2);

    store.toggle('t1');
    expect(store.pendingTodos.value.map((t) => t.id)).toEqual(['t2']);

    store.remove('t2');
    expect(store.entities.value).toHaveLength(1);
    expect(store.entities.value[0]?.id).toBe('t1');

    store.loadAll([
      { id: 'r1', title: 'reset 1', done: false },
      { id: 'r2', title: 'reset 2', done: false },
    ]);
    expect(store.entities.value.map((t) => t.id)).toEqual(['r1', 'r2']);
  });

  it('does not re-trigger one collection computed when another collection mutates', () => {
    const todosCfg = entityConfig<Todo>();
    const usersCfg = entityConfig<User, 'users'>({
      collection: 'users',
      selectId: (u) => u.uuid,
    });

    const store = signalStore(withEntities(todosCfg), withEntities(usersCfg));

    let todoEntitiesEvaluations = 0;
    const dispose = effect(() => {
      todoEntitiesEvaluations += 1;
      // touch the signal so it tracks
      store.entities.value;
    });

    const initial = todoEntitiesEvaluations;
    expect(initial).toBeGreaterThan(0);

    // mutate users collection — must NOT trigger the todos effect
    patchState(store, addEntity({ uuid: 'u1', name: 'alice' }, usersCfg));
    expect(todoEntitiesEvaluations).toBe(initial);

    // mutate todos collection — MUST trigger the todos effect (at least once)
    patchState(store, addEntity({ id: 't1', title: 't', done: false }, todosCfg));
    expect(todoEntitiesEvaluations).toBeGreaterThan(initial);

    dispose();
  });

  it('handles 1000 sequential addEntity calls', () => {
    const cfg = entityConfig<{ id: number }>();
    const store = signalStore(withEntities(cfg));

    const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    patchState(store, addEntities(items, cfg));

    expect(store.ids.value).toHaveLength(1000);
    expect(store.entities.value[999]?.id).toBe(999);
  });
});
