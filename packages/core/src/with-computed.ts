import type { ReadonlySignal } from '@preact/signals-core';
import type { SignalStoreFeature } from './types';

/**
 * Add derived signals (computed values) to a store.
 *
 * The callback receives everything declared by previous features (state +
 * earlier computed/methods) and must return an object whose keys are
 * `ReadonlySignal` instances — typically built with `computed()` from
 * `@preact/signals-core`. Derived signals update automatically when their
 * dependencies change and only recompute when read.
 *
 * @param fn — receives the upstream slice; returns one entry per computed
 *   signal to expose on the store.
 * @example
 * ```ts
 * import { signalStore, withState, withComputed } from '@fluch/signal-store';
 * import { computed } from '@preact/signals-core';
 *
 * const store = signalStore(
 *   withState({ count: 0 }),
 *   withComputed(({ count }) => ({
 *     double: computed(() => count.value * 2),
 *     isPositive: computed(() => count.value > 0),
 *   })),
 * );
 * ```
 */
export function withComputed<
  Input extends Record<string, unknown>,
  C extends Record<string, ReadonlySignal<unknown>>,
>(fn: (input: Input) => C): SignalStoreFeature<Input, C> {
  return (input) => fn(input);
}
