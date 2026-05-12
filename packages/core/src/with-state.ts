import { signal } from '@preact/signals-core';
import { devFreeze } from './dev-freeze';
import { getMeta } from './store-meta';
import type { EmptySlot, SignalStoreFeature, StateSignals } from './types';

export function withState<S extends Record<string, unknown>>(
  initial: S,
): SignalStoreFeature<EmptySlot, StateSignals<S>> {
  return (input) => {
    const meta = getMeta(input);
    if (meta !== undefined) return meta.declareState(initial);
    const out = {} as StateSignals<S>;
    for (const key in initial) {
      out[key] = signal(devFreeze(initial[key])) as StateSignals<S>[typeof key];
    }
    return out;
  };
}
