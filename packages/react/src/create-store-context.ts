import { destroyStore } from '@fluch/signal-store';
import {
  createContext,
  createElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

/**
 * Props accepted by the Provider returned from {@link createStoreContext}.
 *
 * When the factory takes no arguments (`P = void`), only `children` is
 * required. When the factory takes a `P`, the Provider's props are
 * `{ children?: ReactNode } & P` — passing `initial` etc. is enforced by
 * TypeScript.
 */
// biome-ignore lint/suspicious/noConfusingVoidType: `[P] extends [void]` is the discriminator that lets the factory be either `() => Store` or `(props) => Store` while keeping `P = void` as a usable default.
export type ProviderProps<P> = [P] extends [void]
  ? { children?: ReactNode }
  : { children?: ReactNode } & P;

/**
 * The pair returned by {@link createStoreContext}: a `<Provider>` that builds
 * and owns the store, and a `useStore()` hook typed exactly as the store
 * returned by the factory.
 */
export interface StoreContext<Store, P> {
  Provider: (props: ProviderProps<P>) => ReactElement;
  useStore: () => Store;
}

/**
 * Scope a signal-store instance to a React subtree.
 *
 * Returns a `{ Provider, useStore }` pair backed by a dedicated React Context.
 * The Provider calls `factory` exactly once at mount, owns the store for the
 * lifetime of that mount, and tears down its internal rxjs pipeline on
 * unmount (you never call `destroyStore` yourself). Props are **read once**
 * at mount — to rebuild with new props, pass a different `key` to force a
 * remount. `useStore()` throws if called outside its Provider.
 *
 * Use this when you need scoped instances (per-route, per-feature, per-test)
 * or a store seeded from React props. For a singleton store, just create one
 * with `signalStore(...)` at module scope.
 *
 * @param factory — builds the store; receives the Provider's props as a
 *   single argument (typed by `P`).
 * @returns `{ Provider, useStore }` — both typed against the factory.
 * @example
 * ```tsx
 * import { signalStore, withState, withMethods, patchState } from '@fluch/signal-store';
 * import { createStoreContext } from '@fluch/signal-store-react';
 *
 * const { Provider, useStore } = createStoreContext(() =>
 *   signalStore(
 *     withState({ count: 0 }),
 *     withMethods((s) => ({
 *       increment: () => patchState(s, { count: s.count.value + 1 }),
 *     })),
 *   ),
 * );
 *
 * function Counter() {
 *   const store = useStore();
 *   return <button onClick={store.increment}>{store.count.value}</button>;
 * }
 *
 * export function App() {
 *   return <Provider><Counter /></Provider>;
 * }
 * ```
 * @example
 * Factory with props (read-once at mount; use `key` to reset):
 * ```tsx
 * const { Provider, useStore } = createStoreContext(
 *   (props: { initial: number }) =>
 *     signalStore(withState({ count: props.initial })),
 * );
 *
 * <Provider key={userId} initial={42}>...</Provider>;
 * ```
 */
export function createStoreContext<Store extends object, P = void>(
  factory: (props: P) => Store,
): StoreContext<Store, P> {
  const Ctx = createContext<Store | null>(null);

  function Provider(props: ProviderProps<P>): ReactElement {
    const { children, ...rest } = props as ProviderProps<P> & { children?: ReactNode };
    const [store] = useState<Store>(() => factory(rest as unknown as P));
    useEffect(() => () => destroyStore(store), [store]);
    return createElement(Ctx.Provider, { value: store }, children);
  }

  function useStore(): Store {
    const store = useContext(Ctx);
    if (store === null) {
      throw new Error(
        '[@fluch/signal-store-react] useStore() must be called inside its <Provider>.',
      );
    }
    return store;
  }

  return { Provider, useStore };
}
