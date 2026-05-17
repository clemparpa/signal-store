# @fluch/signal-store

## 1.0.0

### Major Changes

- b995e58: Initial stable release at `1.0.0`. All four public packages now share a unified version line via changeset `fixed` mode — a bump on any package bumps the whole group. This locks the API surface for v1 and signals semver compatibility going forward.

## 0.5.1

### Patch Changes

- 5e023a1: Add `@fluch/signal-store-devtools` — a Redux DevTools Extension bridge for signal-store. Wrap `connectDevtools(store, { name })` in a dev guard (`if (import.meta.env.DEV)`) to get an action timeline, state tree, and diff view in the extension panel.

  - Action labels are derived from the JS stack trace of each `patchState` call (V8/SpiderMonkey supported, `STATE_UPDATE` fallback). Pass `trace: false` to disable.
  - Monitor-only: time travel, dispatched actions, and skip/reorder are deliberately out of scope for this release.
  - Package is `sideEffects: false`; the entire import is tree-shaken out of production bundles when the call is guarded.

  To support the bridge, `@fluch/signal-store` now exposes a `'./internal'` subpath (`import { getMeta } from '@fluch/signal-store/internal'`) reserved for first-party tooling. The main entry point is unchanged.

## 0.5.0

### Minor Changes

- f790826: Add `rxMethod(store, generator)` and `toObservable(signal)` — RxJS-powered managed methods for signal-stores. `rxMethod` wires a shared `Subject<Input>` through the user-provided pipeline and subscribes once, so stateful operators like `debounceTime`, `switchMap`, and `concatMap` behave correctly across invocations. The returned method accepts a scalar, a Preact signal, or an `Observable<Input>`. The pipeline subscription is registered on the store's internal cleanup, so `destroyStore` (and the React Provider's unmount) tears everything down automatically; post-destroy invocations are a silent no-op aligned with `patchState`. `toObservable` wraps a Preact signal as a cold `Observable<T>` that emits the current value synchronously on subscribe, then every change. `toSignal` (inverse) is deferred — open an issue with a use case.

## 0.4.0

### Minor Changes

- d8b5c7d: Add `withHooks({ onInit, onDestroy })` — lifecycle hooks for signal-stores. `onInit` runs once at the end of `signalStore(...)` after every feature has been composed, with full access to signals, computed, and methods (and may push initial mutations via `patchState`). `onDestroy` runs once on `destroyStore` (automatically on Provider unmount in React), at which point `patchState` is already a silent no-op. Multiple `withHooks(...)` compose: `onInit` callbacks fire in composition order, `onDestroy` callbacks fire in reverse (LIFO). Both callbacks are optional and may be async (untracked, same semantics as `withMethods`).

## 0.3.1

### Patch Changes

- 0f1ab46: Add TSDoc docstrings with usage examples to every public export. Improves IntelliSense in editors and enriches the TypeDoc-generated API pages on the docs site. No runtime change.

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
