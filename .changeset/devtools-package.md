---
'@fluch/signal-store-devtools': minor
'@fluch/signal-store': patch
---

Add `@fluch/signal-store-devtools` — a Redux DevTools Extension bridge for signal-store. Wrap `connectDevtools(store, { name })` in a dev guard (`if (import.meta.env.DEV)`) to get an action timeline, state tree, and diff view in the extension panel.

- Action labels are derived from the JS stack trace of each `patchState` call (V8/SpiderMonkey supported, `STATE_UPDATE` fallback). Pass `trace: false` to disable.
- Monitor-only: time travel, dispatched actions, and skip/reorder are deliberately out of scope for this release.
- Package is `sideEffects: false`; the entire import is tree-shaken out of production bundles when the call is guarded.

To support the bridge, `@fluch/signal-store` now exposes a `'./internal'` subpath (`import { getMeta } from '@fluch/signal-store/internal'`) reserved for first-party tooling. The main entry point is unchanged.
