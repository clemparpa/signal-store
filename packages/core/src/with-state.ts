import { devFreeze } from './dev-freeze';
import { registerState } from './store-meta';
import type { EmptySlot, SignalStoreFeature, StateSignals } from './types';

export function withState<S extends Record<string, unknown>>(
  initial: S,
): SignalStoreFeature<EmptySlot, StateSignals<S>> {
  return (input) => {
    const out = {} as StateSignals<S>;
    for (const key in initial) {
      out[key] = registerState(input as object, key, devFreeze(initial[key]));
    }
    return out;
  };
}
