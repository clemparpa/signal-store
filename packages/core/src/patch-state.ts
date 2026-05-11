import type { Signal } from '@preact/signals-core';
import { devFreeze } from './dev-freeze';
import { getMeta } from './store-meta';

type AnyStore = Record<string, Signal<unknown>>;

type StateOf<S extends AnyStore> = {
  [K in keyof S]: S[K]['value'];
};

type Update<State> = Partial<State> | ((current: State) => Partial<State>);

export function patchState<S extends AnyStore>(store: S, ...updates: Update<StateOf<S>>[]): void {
  const meta = getMeta(store);
  if (meta !== undefined) {
    for (const update of updates) {
      meta.mutations$.next(update as never);
    }
    return;
  }

  for (const update of updates) {
    const partial = typeof update === 'function' ? update(readState(store)) : update;
    for (const key in partial) {
      const slot = store[key];
      if (slot !== undefined) {
        slot.value = devFreeze(partial[key]);
      }
    }
  }
}

function readState<S extends AnyStore>(store: S): StateOf<S> {
  const out: Record<string, unknown> = {};
  for (const key in store) {
    const slot = store[key];
    if (slot !== undefined) out[key] = slot.value;
  }
  return out as StateOf<S>;
}
