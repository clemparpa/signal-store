---
'@fluch/signal-store': minor
---

Rework the internal state pipeline on top of rxjs and harden the public API.

- New `destroyStore(store)` export to tear down the internal rxjs subscriptions. Idempotent and no-op when called on a non-store object — required for upcoming scoped/provider-bound stores.
- `withState` and `patchState` now throw if used outside `signalStore(...)`. The previous silent fallback (raw signal / direct mutation) is removed.
- Internal state is now centralised in a `state$` `BehaviorSubject` fed by a `mutations$` `Subject` through `scan`. Each top-level state key is a signal projected from `state$` via `distinctUntilChanged`. No public-API change beyond the two points above, but unlocks v2 features (effects, rxMethods).
- Tests: 60 green (vs 48), including 6 new tests for `destroyStore` and 5 covering `withMethods + async/await`.
