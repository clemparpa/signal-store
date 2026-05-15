import { getMeta, type StoreHook } from './store-meta';
import type { EmptySlot, SignalStoreFeature } from './types';

/**
 * Lifecycle callbacks registered by {@link withHooks}.
 *
 * Both callbacks are **synchronous** (`() => void`) — aligned with NgRx
 * SignalStore. For async work, wrap in an explicit IIFE inside the body to
 * make the fire-and-forget intent visible, or use `rxMethod` (v2) for managed
 * pipelines with cancellation.
 *
 * Both callbacks receive the **fully composed** store at runtime (every
 * feature, even those placed after `withHooks` in the call). TypeScript only
 * sees the features that precede `withHooks` in the composition — place
 * `withHooks` last to see everything at the type level.
 */
export interface HooksConfig<In extends object> {
  /** Invoked once after every feature has been composed. Synchronous. */
  onInit?: (store: In) => void;
  /** Invoked once on {@link destroyStore} (and on Provider unmount in React). Synchronous. */
  onDestroy?: (store: In) => void;
}

/**
 * Register lifecycle hooks on a store.
 *
 * - `onInit` runs once at the end of `signalStore(...)`, after every feature
 *   has been composed. It can read every signal and call every method — and
 *   may push initial mutations via {@link patchState}.
 * - `onDestroy` runs once when {@link destroyStore} is invoked (the React
 *   `<Provider>` from `@fluch/signal-store-react` calls it at unmount). The
 *   store is still **live** when `onDestroy` fires: signals are readable,
 *   `patchState` propagates normally, and you can perform a last managed
 *   cleanup. The teardown of the rxjs pipeline happens immediately after.
 *
 * Multiple `withHooks(...)` in the same `signalStore(...)` are allowed:
 * `onInit` callbacks run in composition order; `onDestroy` callbacks run in
 * **reverse** order (LIFO), like a stack of teardowns. Both callbacks are
 * optional independently — `withHooks({})` is a valid no-op.
 *
 * Hooks are synchronous. To trigger async work from a hook, wrap it in an
 * IIFE (`void (async () => { ... })()`) — the store does not track the
 * resulting promise. For cancellable async pipelines, use `rxMethod` (v2).
 *
 * If `onInit` throws, the error propagates out of `signalStore(...)` and the
 * store is not returned. Call `destroyStore` on the partial store from the
 * caller's catch block if you need to release resources.
 *
 * @param hooks — optional `onInit` / `onDestroy` callbacks.
 * @example
 * ```ts
 * import { signalStore, withState, withHooks, patchState } from '@fluch/signal-store';
 *
 * const store = signalStore(
 *   withState({ count: 0 }),
 *   withHooks({
 *     onInit(s) { patchState(s, { count: 1 }); },
 *     onDestroy(s) { console.log('final count:', s.count.value); },
 *   }),
 * );
 *
 * store.count.value; // 1
 * ```
 */
export function withHooks<In extends object>(
  hooks: HooksConfig<In>,
): SignalStoreFeature<In, EmptySlot> {
  return (input) => {
    const meta = getMeta(input);
    if (meta === undefined) {
      throw new Error('withHooks must be composed inside signalStore(...)');
    }
    if (hooks.onInit) meta.initHooks.push(hooks.onInit as StoreHook);
    if (hooks.onDestroy) meta.destroyHooks.push(hooks.onDestroy as StoreHook);
    return {} as EmptySlot;
  };
}
