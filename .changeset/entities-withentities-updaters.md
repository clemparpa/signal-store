---
'@fluch/signal-store-entities': minor
---

Implement `@fluch/signal-store-entities` v0.1.0 with normalized collections (mono- and multi-collection).

- `entityConfig({ collection?, selectId? })` — typed shared config (NgRx-style closure pattern) carrying the collection name and id selector to both `withEntities` and every updater.
- `withEntities(cfg)` — adds `ids`, `entityMap` and a derived `entities` computed signal to the store. With `cfg.collection = 'users'`, signals are prefixed (`usersIds`, `usersEntityMap`, `usersEntities`) — names derived via template literal types, no manual annotation required.
- Updaters: `addEntity` / `addEntities` (append, no-op on duplicate id), `setEntity` / `setEntities` / `setAllEntities` (upsert / replace), `updateEntity` / `updateEntities` / `updateAllEntities` (silent no-op on unknown id; `changes` accepts `Partial<E>` or `(e) => Partial<E>`), `removeEntity` / `removeEntities` (by id array or predicate) / `removeAllEntities`.
- 105 green tests covering unit, integration and type-level scenarios. Bundle size ~1.4 KB gzipped (target <2 KB).

Note on spec divergence: spec §5.4 prescribed a runtime entity-config registry attached to the store. This release uses a closure-based `entityConfig` instead — same ergonomics, no core change required, no global mutable state. The spec will be updated in a follow-up.
