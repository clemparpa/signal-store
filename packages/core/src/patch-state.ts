import type { Signal } from '@preact/signals-core';
import { getMeta } from './store-meta';

type AnyStore = Record<string, Signal<unknown>>;

type StateOf<S extends AnyStore> = {
  [K in keyof S]: S[K]['value'];
};

type Update<State> = Partial<State> | ((current: State) => Partial<State>);

export function patchState<S extends AnyStore>(store: S, ...updates: Update<StateOf<S>>[]): void {
  const meta = getMeta(store);
  if (meta === undefined) {
    throw new Error('patchState requires a store built via signalStore(...)');
  }
  for (const update of updates) {
    meta.mutations$.next(update as never);
  }
}
