import { type Signal, signal } from '@preact/signals-core';
import { devFreeze } from './dev-freeze';
import { registerStateSlot } from './store-meta';
import type { EmptySlot, SignalStoreFeature, StateSignals } from './types';

export function withState<S extends Record<string, unknown>>(
  initial: S,
): SignalStoreFeature<EmptySlot, StateSignals<S>> {
  return (input) => {
    const out = {} as StateSignals<S>;
    for (const key in initial) {
      const frozen = devFreeze(initial[key]);
      const sig = signal(frozen) as Signal<S[typeof key]>;
      out[key] = sig;
      registerStateSlot(input as object, key, sig, frozen);
    }
    return out;
  };
}
