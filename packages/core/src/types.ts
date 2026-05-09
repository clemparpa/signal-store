import type { ReadonlySignal, Signal } from '@preact/signals-core';

// biome-ignore lint/complexity/noBannedTypes: identity element for feature composition (empty slot = no keys added)
export type EmptySlot = {};

export type SignalStoreFeature<Input = EmptySlot, Output = EmptySlot> = (input: Input) => Output;

export type StateSignals<S> = { [K in keyof S]: Signal<S[K]> };

export type ComputedSignals<C> = { [K in keyof C]: ReadonlySignal<C[K]> };
