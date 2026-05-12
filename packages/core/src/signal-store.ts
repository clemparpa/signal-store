import { createStoreInternals } from './store-meta';
import type { EmptySlot, SignalStoreFeature } from './types';

export function signalStore(): EmptySlot;
export function signalStore<Out1 extends object>(f1: SignalStoreFeature<EmptySlot, Out1>): Out1;
export function signalStore<Out1 extends object, Out2 extends object>(
  f1: SignalStoreFeature<EmptySlot, Out1>,
  f2: SignalStoreFeature<EmptySlot & Out1, Out2>,
): Out1 & Out2;
export function signalStore<Out1 extends object, Out2 extends object, Out3 extends object>(
  f1: SignalStoreFeature<EmptySlot, Out1>,
  f2: SignalStoreFeature<EmptySlot & Out1, Out2>,
  f3: SignalStoreFeature<EmptySlot & Out1 & Out2, Out3>,
): Out1 & Out2 & Out3;
export function signalStore<
  Out1 extends object,
  Out2 extends object,
  Out3 extends object,
  Out4 extends object,
>(
  f1: SignalStoreFeature<EmptySlot, Out1>,
  f2: SignalStoreFeature<EmptySlot & Out1, Out2>,
  f3: SignalStoreFeature<EmptySlot & Out1 & Out2, Out3>,
  f4: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3, Out4>,
): Out1 & Out2 & Out3 & Out4;
export function signalStore<
  Out1 extends object,
  Out2 extends object,
  Out3 extends object,
  Out4 extends object,
  Out5 extends object,
>(
  f1: SignalStoreFeature<EmptySlot, Out1>,
  f2: SignalStoreFeature<EmptySlot & Out1, Out2>,
  f3: SignalStoreFeature<EmptySlot & Out1 & Out2, Out3>,
  f4: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3, Out4>,
  f5: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4, Out5>,
): Out1 & Out2 & Out3 & Out4 & Out5;
export function signalStore<
  Out1 extends object,
  Out2 extends object,
  Out3 extends object,
  Out4 extends object,
  Out5 extends object,
  Out6 extends object,
>(
  f1: SignalStoreFeature<EmptySlot, Out1>,
  f2: SignalStoreFeature<EmptySlot & Out1, Out2>,
  f3: SignalStoreFeature<EmptySlot & Out1 & Out2, Out3>,
  f4: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3, Out4>,
  f5: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4, Out5>,
  f6: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5, Out6>,
): Out1 & Out2 & Out3 & Out4 & Out5 & Out6;
export function signalStore<
  Out1 extends object,
  Out2 extends object,
  Out3 extends object,
  Out4 extends object,
  Out5 extends object,
  Out6 extends object,
  Out7 extends object,
>(
  f1: SignalStoreFeature<EmptySlot, Out1>,
  f2: SignalStoreFeature<EmptySlot & Out1, Out2>,
  f3: SignalStoreFeature<EmptySlot & Out1 & Out2, Out3>,
  f4: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3, Out4>,
  f5: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4, Out5>,
  f6: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5, Out6>,
  f7: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5 & Out6, Out7>,
): Out1 & Out2 & Out3 & Out4 & Out5 & Out6 & Out7;
export function signalStore<
  Out1 extends object,
  Out2 extends object,
  Out3 extends object,
  Out4 extends object,
  Out5 extends object,
  Out6 extends object,
  Out7 extends object,
  Out8 extends object,
>(
  f1: SignalStoreFeature<EmptySlot, Out1>,
  f2: SignalStoreFeature<EmptySlot & Out1, Out2>,
  f3: SignalStoreFeature<EmptySlot & Out1 & Out2, Out3>,
  f4: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3, Out4>,
  f5: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4, Out5>,
  f6: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5, Out6>,
  f7: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5 & Out6, Out7>,
  f8: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5 & Out6 & Out7, Out8>,
): Out1 & Out2 & Out3 & Out4 & Out5 & Out6 & Out7 & Out8;
export function signalStore<
  Out1 extends object,
  Out2 extends object,
  Out3 extends object,
  Out4 extends object,
  Out5 extends object,
  Out6 extends object,
  Out7 extends object,
  Out8 extends object,
  Out9 extends object,
>(
  f1: SignalStoreFeature<EmptySlot, Out1>,
  f2: SignalStoreFeature<EmptySlot & Out1, Out2>,
  f3: SignalStoreFeature<EmptySlot & Out1 & Out2, Out3>,
  f4: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3, Out4>,
  f5: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4, Out5>,
  f6: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5, Out6>,
  f7: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5 & Out6, Out7>,
  f8: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5 & Out6 & Out7, Out8>,
  f9: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5 & Out6 & Out7 & Out8, Out9>,
): Out1 & Out2 & Out3 & Out4 & Out5 & Out6 & Out7 & Out8 & Out9;
export function signalStore<
  Out1 extends object,
  Out2 extends object,
  Out3 extends object,
  Out4 extends object,
  Out5 extends object,
  Out6 extends object,
  Out7 extends object,
  Out8 extends object,
  Out9 extends object,
  Out10 extends object,
>(
  f1: SignalStoreFeature<EmptySlot, Out1>,
  f2: SignalStoreFeature<EmptySlot & Out1, Out2>,
  f3: SignalStoreFeature<EmptySlot & Out1 & Out2, Out3>,
  f4: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3, Out4>,
  f5: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4, Out5>,
  f6: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5, Out6>,
  f7: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5 & Out6, Out7>,
  f8: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5 & Out6 & Out7, Out8>,
  f9: SignalStoreFeature<EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5 & Out6 & Out7 & Out8, Out9>,
  f10: SignalStoreFeature<
    EmptySlot & Out1 & Out2 & Out3 & Out4 & Out5 & Out6 & Out7 & Out8 & Out9,
    Out10
  >,
): Out1 & Out2 & Out3 & Out4 & Out5 & Out6 & Out7 & Out8 & Out9 & Out10;
export function signalStore(...features: SignalStoreFeature[]): unknown {
  const acc = createStoreInternals();
  for (const feature of features) {
    const out = feature(acc) as Record<string, unknown>;
    for (const key in out) {
      if (key in acc) {
        throw new Error(
          `signalStore: duplicate key "${key}" — already declared by a previous feature`,
        );
      }
      acc[key] = out[key];
    }
  }
  return acc;
}
