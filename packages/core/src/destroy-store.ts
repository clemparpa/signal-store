import { getMeta } from './store-meta';

/**
 * Tear down a store's internal rxjs pipeline.
 *
 * After teardown, signals keep their last value but subsequent
 * {@link patchState} calls are silently dropped — no more mutations propagate.
 * Idempotent: safe to call multiple times. In React, the `<Provider>` from
 * `@fluch/signal-store-react` calls this automatically on unmount, so app
 * code typically never invokes it.
 *
 * @param store — a store built via {@link signalStore}; non-stores are no-ops.
 * @example
 * ```ts
 * import { signalStore, withState, destroyStore } from '@fluch/signal-store';
 *
 * const store = signalStore(withState({ count: 0 }));
 *
 * // ...later, when the store is no longer needed:
 * destroyStore(store);
 * ```
 */
export function destroyStore(store: object): void {
  const meta = getMeta(store);
  if (meta !== undefined) meta.destroy();
}
