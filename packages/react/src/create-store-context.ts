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

export type ProviderProps<P> = [P] extends [void]
  ? { children?: ReactNode }
  : { children?: ReactNode } & P;

export interface StoreContext<Store, P> {
  Provider: (props: ProviderProps<P>) => ReactElement;
  useStore: () => Store;
}

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
