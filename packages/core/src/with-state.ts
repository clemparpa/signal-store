import { getMeta } from './store-meta';
import type { EmptySlot, SignalStoreFeature, StateSignals } from './types';

/**
 * Declare the store's initial state.
 *
 * Each top-level key of `initial` becomes a `ReadonlySignal` exposed on the
 * store. Read via `.value`; write via {@link patchState}. Must be used as the
 * first feature inside {@link signalStore}; calling it twice throws.
 *
 * @param initial — plain object describing the state shape and seed values.
 * @example
 * ```ts
 * import { signalStore, withState } from '@fluch/signal-store';
 *
 * const store = signalStore(
 *   withState({ count: 0, name: 'world' }),
 * );
 *
 * store.count.value; // 0
 * store.name.value;  // 'world'
 * ```
 */
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
