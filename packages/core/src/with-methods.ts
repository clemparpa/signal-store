import type { SignalStoreFeature } from './types';

/**
 * Attach methods (actions) to a store.
 *
 * The callback receives everything declared by previous features (state +
 * computed + earlier methods) and returns a record of functions. The store's
 * state is mutated by calling {@link patchState} from inside these methods.
 *
 * @param fn — receives the upstream slice; returns one entry per method to
 *   expose on the store.
 * @example
 * ```ts
 * import { signalStore, withState, withMethods, patchState } from '@fluch/signal-store';
 *
 * const counter = signalStore(
 *   withState({ count: 0 }),
 *   withMethods((store) => ({
 *     increment: () => patchState(store, { count: store.count.value + 1 }),
 *     reset: () => patchState(store, { count: 0 }),
 *   })),
 * );
 *
 * counter.increment();
 * counter.count.value; // 1
 * ```
 */
export function withMethods<
  Input extends Record<string, unknown>,
  // biome-ignore lint/suspicious/noExplicitAny: methods accept arbitrary args
  M extends Record<string, (...args: any[]) => unknown>,
>(fn: (input: Input) => M): SignalStoreFeature<Input, M> {
  return (input) => fn(input);
}
