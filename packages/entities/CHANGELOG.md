# @fluch/signal-store-entities

## 1.0.0

### Major Changes

- b995e58: Initial stable release at `1.0.0`. All four public packages now share a unified version line via changeset `fixed` mode — a bump on any package bumps the whole group. This locks the API surface for v1 and signals semver compatibility going forward.

### Patch Changes

- Updated dependencies [b995e58]
  - @fluch/signal-store@1.0.0

## 0.2.0

### Minor Changes

- dee76c4: Add `sortComparer` option to `entityConfig`. When provided, `<C>Entities` returns the array sorted by the comparator on every read (memoized via `computed`). Internal `<C>Ids` order is preserved; no updater signatures change.

  - Opt-in and non-breaking: collections without a comparator behave identically to before (insertion order).
  - The comparator must depend only on `a` and `b` — for dynamic sort direction, build it in `withComputed`.
  - `Array.prototype.sort` is stable since ES2019, so equal items keep their insertion order with no manual tie-breaker.

## 0.1.4

### Patch Changes

- Updated dependencies [5e023a1]
  - @fluch/signal-store@0.5.1

## 0.1.3

### Patch Changes

- Updated dependencies [f790826]
  - @fluch/signal-store@0.5.0

## 0.1.2

### Patch Changes

- Updated dependencies [d8b5c7d]
  - @fluch/signal-store@0.4.0

## 0.1.1

### Patch Changes

- 0f1ab46: Add TSDoc docstrings with usage examples to every public export. Improves IntelliSense in editors and enriches the TypeDoc-generated API pages on the docs site. No runtime change.
- Updated dependencies [0f1ab46]
  - @fluch/signal-store@0.3.1

## 0.1.0

### Minor Changes

- 78ed73f: Implement `@fluch/signal-store-entities` v0.1.0 with normalized collections (mono- and multi-collection).

  - `entityConfig({ collection?, selectId? })` — typed shared config (NgRx-style closure pattern) carrying the collection name and id selector to both `withEntities` and every updater.
  - `withEntities(cfg)` — adds `ids`, `entityMap` and a derived `entities` computed signal to the store. With `cfg.collection = 'users'`, signals are prefixed (`usersIds`, `usersEntityMap`, `usersEntities`) — names derived via template literal types, no manual annotation required.
  - Updaters: `addEntity` / `addEntities` (append, no-op on duplicate id), `setEntity` / `setEntities` / `setAllEntities` (upsert / replace), `updateEntity` / `updateEntities` / `updateAllEntities` (silent no-op on unknown id; `changes` accepts `Partial<E>` or `(e) => Partial<E>`), `removeEntity` / `removeEntities` (by id array or predicate) / `removeAllEntities`.
  - 105 green tests covering unit, integration and type-level scenarios. Bundle size ~1.4 KB gzipped (target <2 KB).

  Note on spec divergence: spec §5.4 prescribed a runtime entity-config registry attached to the store. This release uses a closure-based `entityConfig` instead — same ergonomics, no core change required, no global mutable state. The spec will be updated in a follow-up.

## 0.0.3

### Patch Changes

- Updated dependencies [13e9aba]
  - @fluch/signal-store@0.3.0

## 0.0.2

### Patch Changes

- Updated dependencies [6c45ed9]
  - @fluch/signal-store@0.2.0

## 0.0.1

### Patch Changes

- Updated dependencies [6e36337]
  - @fluch/signal-store@0.1.0
