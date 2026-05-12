import { getMeta } from './store-meta';
import type { EmptySlot, SignalStoreFeature, StateSignals } from './types';

export function withState<S extends Record<string, unknown>>(
  initial: S,
): SignalStoreFeature<EmptySlot, StateSignals<S>> {
  return (input) => {
    const meta = getMeta(input);
    if (meta === undefined) {
      throw new Error('withState must be used inside signalStore(...)');
    }
    return meta.declareState(initial);
  };
}
