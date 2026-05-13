import type { ReadonlySignal } from '@preact/signals-core';

/**
 * Identity element for feature composition — an object type with no keys.
 *
 * Used as the seed input of the first feature in {@link signalStore} and as
 * the default `Input`/`Output` of {@link SignalStoreFeature}.
 */
// biome-ignore lint/complexity/noBannedTypes: identity element for feature composition (empty slot = no keys added)
export type EmptySlot = {};

/**
 * Building block for {@link signalStore}: a function that, given the slice
 * declared by previous features, returns the keys it contributes.
 *
 * `withState`, `withComputed`, and `withMethods` all return a
 * `SignalStoreFeature`. Use this type to write your own reusable features.
 *
 * @typeParam Input — the shape contributed by all earlier features.
 * @typeParam Output — the shape this feature adds.
 * @example
 * ```ts
 * import type { SignalStoreFeature } from '@fluch/signal-store';
 *
 * // A feature that exposes a constant "version" string.
 * const withVersion: SignalStoreFeature<{}, { version: string }> = () => ({
 *   version: '1.0.0',
 * });
 * ```
 */
export type SignalStoreFeature<Input = EmptySlot, Output = EmptySlot> = (input: Input) => Output;

/**
 * Map a plain state object to its read-only signal facade — each property `K`
 * becomes a `ReadonlySignal<S[K]>`.
 */
export type StateSignals<S> = { [K in keyof S]: ReadonlySignal<S[K]> };

/**
 * Map a record of computed-value types to a record of `ReadonlySignal`s.
 */
export type ComputedSignals<C> = { [K in keyof C]: ReadonlySignal<C[K]> };
