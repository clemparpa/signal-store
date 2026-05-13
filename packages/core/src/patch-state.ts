import type { Signal } from '@preact/signals-core';
import { getMeta } from './store-meta';

type AnyStore = Record<string, Signal<unknown>>;

type StateOf<S extends AnyStore> = {
  [K in keyof S]: S[K]['value'];
};

type Update<State> = Partial<State> | ((current: State) => Partial<State>);

/**
 * Apply one or more partial updates to a store's state.
 *
 * Each update is either a partial object (merged shallowly) or a function
 * receiving the current state and returning a partial. Multiple updates passed
 * in a single call are applied in order. Updates flow through the store's
 * internal rxjs pipeline and propagate to signals + computed in one batch.
 *
 * After {@link destroyStore} runs on the store, subsequent calls are silently
 * dropped (no throw, no mutation).
 *
 * @param store — a store built via {@link signalStore}.
 * @param updates — partial objects and/or updater functions.
 * @example
 * ```ts
 * import { signalStore, withState, patchState } from '@fluch/signal-store';
 *
 * const store = signalStore(withState({ count: 0, name: 'world' }));
 *
 * // Partial-object form
 * patchState(store, { count: 1 });
 *
 * // Updater-function form (read-then-write)
 * patchState(store, (s) => ({ count: s.count + 1 }));
 *
 * // Multiple updates in one call (applied left-to-right)
 * patchState(store, { count: 0 }, { name: 'reset' });
 * ```
 */
export function patchState<S extends AnyStore>(store: S, ...updates: Update<StateOf<S>>[]): void {
  const meta = getMeta(store);
  if (meta === undefined) {
    throw new Error('patchState requires a store built via signalStore(...)');
  }
  for (const update of updates) {
    meta.mutations$.next(update as never);
  }
}
