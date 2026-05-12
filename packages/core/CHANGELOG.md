# @fluch/signal-store

## 0.3.0

### Minor Changes

- 13e9aba: Rework the internal state pipeline on top of rxjs and harden the public API.

  - New `destroyStore(store)` export to tear down the internal rxjs subscriptions. Idempotent and no-op when called on a non-store object — required for upcoming scoped/provider-bound stores.
  - `withState` and `patchState` now throw if used outside `signalStore(...)`. The previous silent fallback (raw signal / direct mutation) is removed.
  - Internal state is now centralised in a `state$` `BehaviorSubject` fed by a `mutations$` `Subject` through `scan`. Each top-level state key is a signal projected from `state$` via `distinctUntilChanged`. No public-API change beyond the two points above, but unlocks v2 features (effects, rxMethods).
  - Tests: 60 green (vs 48), including 6 new tests for `destroyStore` and 5 covering `withMethods + async/await`.

## 0.2.0

### Minor Changes

- 6c45ed9: Add `withComputed` and `withMethods` to the core package.

  - `withComputed(fn)` declares reactive derived signals; `fn` receives the store accumulated so far (state + previous computed) and returns a record of `ReadonlySignal`s.
  - `withMethods(fn)` declares store methods; `fn` receives the accumulated store and returns a record of synchronous functions. Methods typically call `patchState`.
  - `signalStore` now propagates the cumulative output as the input type of each subsequent feature (via variadic overloads, up to 10 features), so `withComputed`/`withMethods` infer their `fn` argument without manual annotation.
  - `signalStore` now throws at runtime if two features declare the same key, even if TypeScript narrowing didn't catch it.

## 0.1.0

### Minor Changes

- 6e36337: Add core API: `signalStore`, `withState`, `patchState`.

  - `signalStore(...features)` composes a typed store from a list of `SignalStoreFeature`s
  - `withState(initial)` creates one signal per top-level key, freezing values in dev to catch direct mutations
  - `patchState(store, ...updates)` applies one or more partial updates (object or function) to the store, only notifying subscribers of the keys actually present in each update
