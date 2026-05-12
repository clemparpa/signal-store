# @fluch/signal-store-entities

Entity collection helpers for [@fluch/signal-store](../core/README.md). Normalized state (`ids` + `entityMap`), an `entities` computed signal, and a set of NgRx-style updaters that compose with `patchState`.

## Install

```sh
pnpm add @fluch/signal-store @fluch/signal-store-entities @preact/signals-core
```

## Quick start (mono-collection)

```ts
import { signalStore, withMethods, patchState } from '@fluch/signal-store';
import {
  entityConfig,
  withEntities,
  addEntity,
  updateEntity,
  removeEntity,
} from '@fluch/signal-store-entities';

type Todo = { id: string; title: string; done: boolean };

const todosCfg = entityConfig<Todo>();

export const todos = signalStore(
  withEntities(todosCfg),
  withMethods((s) => ({
    add: (t: Todo) => patchState(s, addEntity(t, todosCfg)),
    toggle: (id: string) =>
      patchState(s, updateEntity({ id, changes: (t) => ({ done: !t.done }) }, todosCfg)),
    remove: (id: string) => patchState(s, removeEntity(id, todosCfg)),
  })),
);

todos.add({ id: 'a', title: 'first', done: false });
todos.entities.value; // → [{ id: 'a', title: 'first', done: false }]
```

## Multi-collection

Pass a `collection` name to `entityConfig` and the feature prefixes the signals (`usersIds`, `usersEntityMap`, `usersEntities`):

```ts
type User = { uuid: string; name: string };

const usersCfg = entityConfig<User, 'users'>({
  collection: 'users',
  selectId: (u) => u.uuid,
});

const store = signalStore(
  withEntities(todosCfg),
  withEntities(usersCfg),
);

store.ids.value;         // todos
store.usersIds.value;    // users
```

## Updaters

All updaters take an `entityConfig` so they know which collection to target and how to read the entity id.

- `addEntity(e, cfg)` — append; no-op if the id already exists.
- `addEntities(es, cfg)` — append many, deduplicates against existing ids and within the input.
- `setEntity(e, cfg)` — upsert (replaces if the id exists).
- `setEntities(es, cfg)` — upsert many.
- `setAllEntities(es, cfg)` — replace the entire collection.
- `updateEntity({ id, changes }, cfg)` — merge a `Partial<E>` or `(e) => Partial<E>` patch; no-op if unknown id.
- `updateEntities([...], cfg)` — same, batched.
- `updateAllEntities(changes, cfg)` — apply the same patch to every entity.
- `removeEntity(id, cfg)` — remove by id.
- `removeEntities(ids, cfg)` — remove a list of ids (unknown ids are ignored).
- `removeAllEntities(cfg)` — clear the collection.

To remove by predicate, compute the id list upstream:

```ts
const doneIds = todos.entities.value.filter((t) => t.done).map((t) => t.id);
patchState(todos, removeEntities(doneIds, todosCfg));
```

## Custom id selector

```ts
const usersCfg = entityConfig<User, 'users'>({
  collection: 'users',
  selectId: (u) => u.uuid,
});
```

The default is `(e) => e.id`. The selector runs at updater time, never at read time.

## Sorting and filtering

There is no `sortComparer` option (deliberate — v2 territory). Derive sorted or filtered views with `withComputed`:

```ts
import { computed } from '@preact/signals-core';
import { withComputed } from '@fluch/signal-store';

withComputed(({ entities }) => ({
  pending: computed(() => entities.value.filter((t) => !t.done)),
  byTitle: computed(() => [...entities.value].sort((a, b) => a.title.localeCompare(b.title))),
}));
```

## Docs

Full guide and API reference: <https://clemparpa.github.io/signal-store/>.
