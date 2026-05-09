import type { ReadonlySignal } from '@preact/signals-core';
import type { SignalStoreFeature } from './types';

export function withComputed<
  Input extends Record<string, unknown>,
  C extends Record<string, ReadonlySignal<unknown>>,
>(fn: (input: Input) => C): SignalStoreFeature<Input, C> {
  return (input) => fn(input);
}
