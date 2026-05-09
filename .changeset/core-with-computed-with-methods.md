---
'@fluch/signal-store': minor
---

Add `withComputed` and `withMethods` to the core package.

- `withComputed(fn)` declares reactive derived signals; `fn` receives the store accumulated so far (state + previous computed) and returns a record of `ReadonlySignal`s.
- `withMethods(fn)` declares store methods; `fn` receives the accumulated store and returns a record of synchronous functions. Methods typically call `patchState`.
- `signalStore` now propagates the cumulative output as the input type of each subsequent feature (via variadic overloads, up to 10 features), so `withComputed`/`withMethods` infer their `fn` argument without manual annotation.
- `signalStore` now throws at runtime if two features declare the same key, even if TypeScript narrowing didn't catch it.
