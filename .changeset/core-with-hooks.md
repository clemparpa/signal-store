---
'@fluch/signal-store': minor
---

Add `withHooks({ onInit, onDestroy })` — lifecycle hooks for signal-stores. `onInit` runs once at the end of `signalStore(...)` after every feature has been composed, with full access to signals, computed, and methods (and may push initial mutations via `patchState`). `onDestroy` runs once on `destroyStore` (automatically on Provider unmount in React), at which point `patchState` is already a silent no-op. Multiple `withHooks(...)` compose: `onInit` callbacks fire in composition order, `onDestroy` callbacks fire in reverse (LIFO). Both callbacks are optional and may be async (untracked, same semantics as `withMethods`).
