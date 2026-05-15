import { computed } from '@preact/signals-core';
import { describe, expect, it, vi } from 'vitest';
import { destroyStore } from './destroy-store';
import { patchState } from './patch-state';
import { signalStore } from './signal-store';
import { withComputed } from './with-computed';
import { withHooks } from './with-hooks';
import { withMethods } from './with-methods';
import { withState } from './with-state';

describe('withHooks — onInit', () => {
  it('runs onInit exactly once at construction', () => {
    const onInit = vi.fn();

    signalStore(withState({ count: 0 }), withHooks({ onInit }));

    expect(onInit).toHaveBeenCalledTimes(1);
  });

  it('passes the fully composed store to onInit (state + computed + methods)', () => {
    let observed: { count: number; double: number; hasInc: boolean } | undefined;

    const store = signalStore(
      withState({ count: 3 }),
      withComputed(({ count }) => ({ double: computed(() => count.value * 2) })),
      withMethods((s) => ({
        inc: () => patchState(s, { count: s.count.value + 1 }),
      })),
      withHooks({
        onInit(s) {
          observed = {
            count: s.count.value,
            double: s.double.value,
            hasInc: typeof s.inc === 'function',
          };
        },
      }),
    );

    expect(observed).toEqual({ count: 3, double: 6, hasInc: true });
    expect(store.count.value).toBe(3);
  });

  it('lets onInit mutate the initial state via patchState', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withHooks({
        onInit(s) {
          patchState(s, { count: 42 });
        },
      }),
    );

    expect(store.count.value).toBe(42);
  });

  it('runs multiple onInit callbacks in composition order', () => {
    const log: number[] = [];

    signalStore(
      withState({ count: 0 }),
      withHooks({ onInit: () => log.push(1) }),
      withHooks({ onInit: () => log.push(2) }),
      withHooks({ onInit: () => log.push(3) }),
    );

    expect(log).toEqual([1, 2, 3]);
  });

  it('does not require onDestroy', () => {
    expect(() =>
      signalStore(withState({ count: 0 }), withHooks({ onInit: () => {} })),
    ).not.toThrow();
  });

  it('does not block on IIFE-wrapped async work — store is usable immediately', async () => {
    let asyncDone = false;

    const store = signalStore(
      withState({ count: 0 }),
      withHooks({
        onInit(s) {
          void (async () => {
            await Promise.resolve();
            patchState(s, { count: 1 });
            asyncDone = true;
          })();
        },
      }),
    );

    expect(asyncDone).toBe(false);
    expect(store.count.value).toBe(0);

    await Promise.resolve();
    expect(asyncDone).toBe(true);
    expect(store.count.value).toBe(1);
  });
});

describe('withHooks — onDestroy', () => {
  it('runs onDestroy exactly once when destroyStore is called', () => {
    const onDestroy = vi.fn();

    const store = signalStore(withState({ count: 0 }), withHooks({ onDestroy }));
    expect(onDestroy).not.toHaveBeenCalled();

    destroyStore(store);
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — onDestroy is not called twice on double destroy', () => {
    const onDestroy = vi.fn();

    const store = signalStore(withState({ count: 0 }), withHooks({ onDestroy }));

    destroyStore(store);
    destroyStore(store);

    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it('passes the store to onDestroy with last-known signal values', () => {
    let snapshot: number | undefined;

    const store = signalStore(
      withState({ count: 0 }),
      withHooks({
        onDestroy(s) {
          snapshot = s.count.value;
        },
      }),
    );

    patchState(store, { count: 7 });
    destroyStore(store);

    expect(snapshot).toBe(7);
  });

  it('lets patchState inside onDestroy propagate (store is still live)', () => {
    const store = signalStore(
      withState({ count: 5 }),
      withHooks({
        onDestroy(s) {
          patchState(s, { count: 999 });
        },
      }),
    );

    destroyStore(store);

    expect(store.count.value).toBe(999);
  });

  it('runs multiple onDestroy callbacks in reverse composition order (LIFO)', () => {
    const log: number[] = [];

    const store = signalStore(
      withState({ count: 0 }),
      withHooks({ onDestroy: () => log.push(1) }),
      withHooks({ onDestroy: () => log.push(2) }),
      withHooks({ onDestroy: () => log.push(3) }),
    );

    destroyStore(store);

    expect(log).toEqual([3, 2, 1]);
  });

  it('does not require onInit', () => {
    const onDestroy = vi.fn();

    const store = signalStore(withState({ count: 0 }), withHooks({ onDestroy }));
    destroyStore(store);

    expect(onDestroy).toHaveBeenCalledTimes(1);
  });
});

describe('withHooks — combined / edge cases', () => {
  it('accepts an empty hooks object with no side effects', () => {
    expect(() => signalStore(withState({ count: 0 }), withHooks({}))).not.toThrow();
  });

  it('runs onInit then onDestroy across the store lifecycle', () => {
    const log: string[] = [];

    const store = signalStore(
      withState({ count: 0 }),
      withHooks({
        onInit: () => log.push('init'),
        onDestroy: () => log.push('destroy'),
      }),
    );

    expect(log).toEqual(['init']);

    destroyStore(store);
    expect(log).toEqual(['init', 'destroy']);
  });

  it('throws an explicit error when withHooks is called outside signalStore()', () => {
    const feature = withHooks({ onInit: () => {} });

    expect(() => feature({})).toThrow(/withHooks must be composed inside signalStore/);
  });
});
