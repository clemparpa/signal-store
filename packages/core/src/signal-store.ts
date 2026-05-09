import type { ComposeAll, SignalStoreFeature } from './types';

export function signalStore<F extends readonly SignalStoreFeature[]>(
  ...features: F
): ComposeAll<F> {
  let acc: Record<string, unknown> = {};
  for (const feature of features) {
    const out = feature(acc);
    acc = { ...acc, ...out };
  }
  return acc as ComposeAll<F>;
}
