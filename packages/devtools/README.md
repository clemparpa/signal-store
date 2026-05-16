# @fluch/signal-store-devtools

Redux DevTools Extension bridge for [@fluch/signal-store](https://www.npmjs.com/package/@fluch/signal-store).

## Install

```sh
pnpm add -D @fluch/signal-store-devtools
```

Install the [Redux DevTools browser extension](https://github.com/reduxjs/redux-devtools/tree/main/extension) if you don't already have it.

## Quick start

```ts
import { signalStore, withState, withMethods, patchState } from '@fluch/signal-store';
import { connectDevtools } from '@fluch/signal-store-devtools';

const counter = signalStore(
  withState({ count: 0 }),
  withMethods((s) => ({
    increment: () => patchState(s, { count: s.count.value + 1 }),
  })),
);

if (import.meta.env.DEV) {
  connectDevtools(counter, { name: 'Counter' });
}

counter.increment(); // DevTools timeline: action "increment", state { count: 1 }
```

Wrap the call in your bundler's DEV guard (`import.meta.env.DEV`, `process.env.NODE_ENV !== 'production'`, …) so the import is tree-shaken out of production bundles.

See the [DevTools guide](https://clemparpa.github.io/signal-store/guides/devtools/) for the full surface.
