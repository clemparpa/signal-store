import type { Signal } from '@preact/signals-core';

// biome-ignore lint/complexity/noBannedTypes: identity element for feature composition (empty slot = no keys added)
export type EmptySlot = {};

export type SignalStoreFeature<Input = EmptySlot, Output = EmptySlot> = (input: Input) => Output;

export type StateSignals<S> = { [K in keyof S]: Signal<S[K]> };

export type ComposeAll<
  F extends readonly SignalStoreFeature[],
  Acc = EmptySlot,
> = F extends readonly [infer Head, ...infer Tail extends readonly SignalStoreFeature[]]
  ? Head extends SignalStoreFeature<infer _In, infer Out>
    ? ComposeAll<Tail, Acc & Out>
    : Acc
  : Acc;
