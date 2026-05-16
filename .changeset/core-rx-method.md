---
'@fluch/signal-store': minor
---

Add `rxMethod(store, generator)` and `toObservable(signal)` — RxJS-powered managed methods for signal-stores. `rxMethod` wires a shared `Subject<Input>` through the user-provided pipeline and subscribes once, so stateful operators like `debounceTime`, `switchMap`, and `concatMap` behave correctly across invocations. The returned method accepts a scalar, a Preact signal, or an `Observable<Input>`. The pipeline subscription is registered on the store's internal cleanup, so `destroyStore` (and the React Provider's unmount) tears everything down automatically; post-destroy invocations are a silent no-op aligned with `patchState`. `toObservable` wraps a Preact signal as a cold `Observable<T>` that emits the current value synchronously on subscribe, then every change. `toSignal` (inverse) is deferred — open an issue with a use case.
