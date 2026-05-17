---
"@fluch/signal-store": minor
---

Add `toSignal(source, initial)` to convert RxJS Observables into Preact signals — the inverse of `toObservable`. Two overloads:

- **Standalone**: `toSignal(source, initial)` returns a `readonly [ReadonlySignal<T>, () => void]` tuple (`useState`-style). The caller releases the inner subscription via `dispose()` — idempotent (RxJS `Subscription.unsubscribe` is a no-op on the second call).
- **Store-aware**: `toSignal(store, source, initial)` returns `ReadonlySignal<T>`. The subscription is registered on the store's internal cleanup and torn down automatically by `destroyStore` (or the React `<Provider>` unmount).

Behavior: `signal.value = initial` synchronously; `next` updates the signal; `error` is routed to `console.error` (signal keeps its last value, never throws); `complete` releases the inner subscription. Calling the store-aware overload on a destroyed store returns a signal at `initial` without subscribing (silent no-op, mirroring `rxMethod`).
