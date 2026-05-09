import { type Signal, signal } from '@preact/signals-core';
import { devFreeze } from './dev-freeze';
import type { EmptySlot, SignalStoreFeature, StateSignals } from './types';

export function withState<S extends Record<string, unknown>>(
  initial: S,
): SignalStoreFeature<EmptySlot, StateSignals<S>> {
  return () => {
    const out = {} as StateSignals<S>;
    for (const key in initial) {
      out[key] = signal(devFreeze(initial[key])) as Signal<S[typeof key]>;
    }
    return out;
  };
}
