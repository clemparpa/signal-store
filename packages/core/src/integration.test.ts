import { computed, effect } from '@preact/signals-core';
import { describe, expect, it, vi } from 'vitest';
import { patchState } from './patch-state';
import { signalStore } from './signal-store';
import { withComputed } from './with-computed';
import { withMethods } from './with-methods';
import { withState } from './with-state';

describe('integration: state + computed + methods', () => {
  it('runs through a full multi-step user flow with reactivity intact', () => {
    const store = signalStore(
      withState({ count: 0, log: [] as string[] }),
      withComputed(({ count, log }) => ({
        isPositive: computed(() => count.value > 0),
        totalEvents: computed(() => log.value.length),
      })),
      withMethods((s) => ({
        inc: () =>
          patchState(s, (state) => ({
            count: state.count + 1,
            log: [...state.log, `inc → ${state.count + 1}`],
          })),
        dec: () =>
          patchState(s, (state) => ({
            count: state.count - 1,
            log: [...state.log, `dec → ${state.count - 1}`],
          })),
        reset: () => patchState(s, { count: 0, log: [] }),
      })),
    );

    expect(store.count.value).toBe(0);
    expect(store.isPositive.value).toBe(false);
    expect(store.totalEvents.value).toBe(0);

    store.inc();
    store.inc();
    store.inc();
    expect(store.count.value).toBe(3);
    expect(store.isPositive.value).toBe(true);
    expect(store.totalEvents.value).toBe(3);
    expect(store.log.value).toEqual(['inc → 1', 'inc → 2', 'inc → 3']);

    store.dec();
    store.dec();
    store.dec();
    store.dec();
    expect(store.count.value).toBe(-1);
    expect(store.isPositive.value).toBe(false);
    expect(store.totalEvents.value).toBe(7);

    store.reset();
    expect(store.count.value).toBe(0);
    expect(store.isPositive.value).toBe(false);
    expect(store.totalEvents.value).toBe(0);
    expect(store.log.value).toEqual([]);
  });

  it('subscribers see every intermediate value through a long mutation chain', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withComputed(({ count }) => ({
        double: computed(() => count.value * 2),
      })),
      withMethods((s) => ({
        inc: () => patchState(s, { count: s.count.value + 1 }),
      })),
    );

    const seenCounts: number[] = [];
    const seenDoubles: number[] = [];

    const disposeCount = effect(() => {
      seenCounts.push(store.count.value);
    });
    const disposeDouble = effect(() => {
      seenDoubles.push(store.double.value);
    });

    store.inc();
    store.inc();
    store.inc();
    store.inc();
    store.inc();

    expect(seenCounts).toEqual([0, 1, 2, 3, 4, 5]);
    expect(seenDoubles).toEqual([0, 2, 4, 6, 8, 10]);

    disposeCount();
    disposeDouble();
  });

  it('handles 1000 sequential mutations with reactivity surviving end-to-end', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withComputed(({ count }) => ({
        double: computed(() => count.value * 2),
        triple: computed(() => count.value * 3),
      })),
      withMethods((s) => ({
        inc: () => patchState(s, { count: s.count.value + 1 }),
      })),
    );

    let lastDouble = -1;
    let lastTriple = -1;
    const dispose = effect(() => {
      lastDouble = store.double.value;
      lastTriple = store.triple.value;
    });

    for (let i = 0; i < 1000; i++) store.inc();

    expect(store.count.value).toBe(1000);
    expect(store.double.value).toBe(2000);
    expect(store.triple.value).toBe(3000);
    expect(lastDouble).toBe(2000);
    expect(lastTriple).toBe(3000);

    dispose();
  });

  it('a method that mutates two state keys triggers exactly one notification per signal', () => {
    const store = signalStore(
      withState({ a: 0, b: 0 }),
      withMethods((s) => ({
        bumpBoth: () => patchState(s, { a: s.a.value + 1, b: s.b.value + 10 }),
      })),
    );
    const aSpy = vi.fn();
    const bSpy = vi.fn();

    const disposeA = effect(() => aSpy(store.a.value));
    const disposeB = effect(() => bSpy(store.b.value));
    aSpy.mockClear();
    bSpy.mockClear();

    store.bumpBoth();
    store.bumpBoth();
    store.bumpBoth();

    expect(store.a.value).toBe(3);
    expect(store.b.value).toBe(30);
    expect(aSpy).toHaveBeenCalledTimes(3);
    expect(bSpy).toHaveBeenCalledTimes(3);

    disposeA();
    disposeB();
  });

  it('mutating one state key does not notify subscribers of unrelated keys', () => {
    const store = signalStore(
      withState({ a: 0, b: 0 }),
      withComputed(({ a }) => ({
        doubleA: computed(() => a.value * 2),
      })),
      withMethods((s) => ({
        bumpA: () => patchState(s, { a: s.a.value + 1 }),
        bumpB: () => patchState(s, { b: s.b.value + 1 }),
      })),
    );
    const bSpy = vi.fn();
    const doubleASpy = vi.fn();

    const disposeB = effect(() => bSpy(store.b.value));
    const disposeDoubleA = effect(() => doubleASpy(store.doubleA.value));
    bSpy.mockClear();
    doubleASpy.mockClear();

    store.bumpA();
    store.bumpA();
    store.bumpA();

    expect(bSpy).not.toHaveBeenCalled();
    expect(doubleASpy).toHaveBeenCalledTimes(3);

    store.bumpB();

    expect(bSpy).toHaveBeenCalledTimes(1);
    expect(doubleASpy).toHaveBeenCalledTimes(3);

    disposeB();
    disposeDoubleA();
  });
});
