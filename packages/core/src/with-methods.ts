import type { SignalStoreFeature } from './types';

export function withMethods<
  Input extends Record<string, unknown>,
  // biome-ignore lint/suspicious/noExplicitAny: methods accept arbitrary args
  M extends Record<string, (...args: any[]) => unknown>,
>(fn: (input: Input) => M): SignalStoreFeature<Input, M> {
  return (input) => fn(input);
}
