---
'@fluch/signal-store-react': minor
---

Implement `createStoreContext` — returns a typed `{ Provider, useStore }` pair for scoping a signal-store instance to a React subtree (mode B). The Provider builds the store at mount via a factory (with optional typed props) and tears down its rxjs pipeline at unmount, so consumers never touch `destroyStore` directly. Props are read once at mount; force a remount via `key` to rebuild with new props.
