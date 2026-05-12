# @fluch/signal-store-react

React Provider + `useStore` for [`@fluch/signal-store`](../core). Scopes a store instance to a subtree instead of using the singleton module pattern.

Use this when you need multiple independent instances of the same store (e.g. per-route, per-feature, per-tenant), or when the store needs construction props from React.

## Install

```sh
pnpm add @fluch/signal-store @fluch/signal-store-react @preact/signals-react react
```

`@preact/signals-react` is what gives you fine-grained reactivity in JSX — set it up once at the consumer level (see the Preact signals docs).

## Quick start

```tsx
import { signalStore, withState, withMethods, patchState } from '@fluch/signal-store';
import { createStoreContext } from '@fluch/signal-store-react';

const { Provider, useStore } = createStoreContext(() =>
  signalStore(
    withState({ count: 0 }),
    withMethods((s) => ({
      increment: () => patchState(s, { count: s.count.value + 1 }),
    })),
  ),
);

export function Counter() {
  const store = useStore();
  return (
    <button onClick={store.increment}>
      count: {store.count.value}
    </button>
  );
}

export function App() {
  return (
    <Provider>
      <Counter />
    </Provider>
  );
}
```

## Factory with props

The factory receives the Provider's props. Useful for seeding the store from React state, route params, etc.

```tsx
const { Provider, useStore } = createStoreContext(
  (props: { userId: string }) =>
    signalStore(withState({ userId: props.userId, profile: null })),
);

<Provider userId="alice">
  <Profile />
</Provider>;
```

Props are read **once at mount**. To rebuild the store with different props, force a remount via React's `key`:

```tsx
<Provider key={userId} userId={userId}>
  <Profile />
</Provider>
```

## Lifecycle

The Provider builds the store at mount and tears down its rxjs pipeline at unmount. You never call `destroyStore` yourself — it's handled internally.

## API

- `createStoreContext(factory)` — returns `{ Provider, useStore }` typed against the store the factory builds. Calling `useStore()` outside its Provider throws.

That's it. The package is intentionally tiny: a single hook, a single Provider, perfect type inference via closure.

## Docs

Full guide and API reference: [signal-store docs](https://clemparpa.github.io/signal-store/guides/react/).
