# @fluch/signal-store-react

## 0.1.4

### Patch Changes

- Updated dependencies [5e023a1]
  - @fluch/signal-store@0.5.1

## 0.1.3

### Patch Changes

- Updated dependencies [f790826]
  - @fluch/signal-store@0.5.0

## 0.1.2

### Patch Changes

- Updated dependencies [d8b5c7d]
  - @fluch/signal-store@0.4.0

## 0.1.1

### Patch Changes

- 0f1ab46: Add TSDoc docstrings with usage examples to every public export. Improves IntelliSense in editors and enriches the TypeDoc-generated API pages on the docs site. No runtime change.
- Updated dependencies [0f1ab46]
  - @fluch/signal-store@0.3.1

## 0.1.0

### Minor Changes

- 6ce3551: Implement `createStoreContext` — returns a typed `{ Provider, useStore }` pair for scoping a signal-store instance to a React subtree (mode B). The Provider builds the store at mount via a factory (with optional typed props) and tears down its rxjs pipeline at unmount, so consumers never touch `destroyStore` directly. Props are read once at mount; force a remount via `key` to rebuild with new props.

## 0.0.3

### Patch Changes

- Updated dependencies [13e9aba]
  - @fluch/signal-store@0.3.0

## 0.0.2

### Patch Changes

- Updated dependencies [6c45ed9]
  - @fluch/signal-store@0.2.0

## 0.0.1

### Patch Changes

- Updated dependencies [6e36337]
  - @fluch/signal-store@0.1.0
