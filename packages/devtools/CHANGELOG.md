# @fluch/signal-store-devtools

## 1.1.0

### Patch Changes

- Updated dependencies [3f04261]
  - @fluch/signal-store@1.1.0

## 1.0.0

### Major Changes

- b995e58: Initial stable release at `1.0.0`. All four public packages now share a unified version line via changeset `fixed` mode — a bump on any package bumps the whole group. This locks the API surface for v1 and signals semver compatibility going forward.

### Patch Changes

- Updated dependencies [b995e58]
  - @fluch/signal-store@1.0.0

## 0.1.0

### Minor Changes

- 5e023a1: Add `@fluch/signal-store-devtools` — a Redux DevTools Extension bridge for signal-store. Wrap `connectDevtools(store, { name })` in a dev guard (`if (import.meta.env.DEV)`) to get an action timeline, state tree, and diff view in the extension panel.

  - Action labels are derived from the JS stack trace of each `patchState` call (V8/SpiderMonkey supported, `STATE_UPDATE` fallback). Pass `trace: false` to disable.
  - Monitor-only: time travel, dispatched actions, and skip/reorder are deliberately out of scope for this release.
  - Package is `sideEffects: false`; the entire import is tree-shaken out of production bundles when the call is guarded.

  To support the bridge, `@fluch/signal-store` now exposes a `'./internal'` subpath (`import { getMeta } from '@fluch/signal-store/internal'`) reserved for first-party tooling. The main entry point is unchanged.

### Patch Changes

- Updated dependencies [5e023a1]
  - @fluch/signal-store@0.5.1
