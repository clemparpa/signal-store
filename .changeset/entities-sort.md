---
'@fluch/signal-store-entities': minor
---

Add `sortComparer` option to `entityConfig`. When provided, `<C>Entities` returns the array sorted by the comparator on every read (memoized via `computed`). Internal `<C>Ids` order is preserved; no updater signatures change.

- Opt-in and non-breaking: collections without a comparator behave identically to before (insertion order).
- The comparator must depend only on `a` and `b` — for dynamic sort direction, build it in `withComputed`.
- `Array.prototype.sort` is stable since ES2019, so equal items keep their insertion order with no manual tie-breaker.
