# @fluch/signal-store

## 0.1.0

### Minor Changes

- 6e36337: Add core API: `signalStore`, `withState`, `patchState`.

  - `signalStore(...features)` composes a typed store from a list of `SignalStoreFeature`s
  - `withState(initial)` creates one signal per top-level key, freezing values in dev to catch direct mutations
  - `patchState(store, ...updates)` applies one or more partial updates (object or function) to the store, only notifying subscribers of the keys actually present in each update
