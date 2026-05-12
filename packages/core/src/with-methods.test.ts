import { computed } from '@preact/signals-core';
import { describe, expect, it } from 'vitest';
import { destroyStore } from './destroy-store';
import { patchState } from './patch-state';
import { signalStore } from './signal-store';
import { withComputed } from './with-computed';
import { withMethods } from './with-methods';
import { withState } from './with-state';

describe('withMethods', () => {
  it('exposes a synchronous method that calls patchState', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withMethods((s) => ({
        inc: () => patchState(s, { count: s.count.value + 1 }),
      })),
    );

    store.inc();
    store.inc();

    expect(store.count.value).toBe(2);
  });

  it('exposes multiple methods on the store', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withMethods((s) => ({
        inc: () => patchState(s, { count: s.count.value + 1 }),
        reset: () => patchState(s, { count: 0 }),
      })),
    );

    store.inc();
    store.inc();
    store.reset();

    expect(store.count.value).toBe(0);
  });

  it('forwards arguments to the method body', () => {
    const store = signalStore(
      withState({ total: 0 }),
      withMethods((s) => ({
        add: (amount: number) => patchState(s, { total: s.total.value + amount }),
      })),
    );

    store.add(5);
    store.add(7);

    expect(store.total.value).toBe(12);
  });

  it('reads computed signals declared before it', () => {
    const store = signalStore(
      withState({ count: 1 }),
      withComputed(({ count }) => ({
        double: computed(() => count.value * 2),
      })),
      withMethods((s) => ({
        snapshot: () => ({ count: s.count.value, double: s.double.value }),
      })),
    );

    expect(store.snapshot()).toEqual({ count: 1, double: 2 });

    patchState(store, { count: 3 });

    expect(store.snapshot()).toEqual({ count: 3, double: 6 });
  });

  it('reads state lazily at call time, not at definition time', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withMethods((s) => ({
        peek: () => s.count.value,
      })),
    );

    expect(store.peek()).toBe(0);

    patchState(store, { count: 42 });

    expect(store.peek()).toBe(42);
  });

  it('supports the patchState updater function form inside a method', () => {
    const store = signalStore(
      withState({ count: 5 }),
      withMethods((s) => ({
        inc: () => patchState(s, (state) => ({ count: state.count + 1 })),
      })),
    );

    store.inc();
    store.inc();
    store.inc();

    expect(store.count.value).toBe(8);
  });

  it('runs multiple patchState calls within a single method body', () => {
    const store = signalStore(
      withState({ a: 0, b: 0 }),
      withMethods((s) => ({
        bump: () => {
          patchState(s, { a: s.a.value + 1 });
          patchState(s, { b: s.b.value + 10 });
        },
      })),
    );

    store.bump();
    store.bump();

    expect(store.a.value).toBe(2);
    expect(store.b.value).toBe(20);
  });

  it('a later withMethods can call methods declared by an earlier withMethods', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withMethods((s) => ({
        inc: () => patchState(s, { count: s.count.value + 1 }),
      })),
      withMethods((s) => ({
        incTwice: () => {
          s.inc();
          s.inc();
        },
      })),
    );

    store.incTwice();
    store.incTwice();

    expect(store.count.value).toBe(4);
  });
});

describe('withMethods + async/await', () => {
  it('applies patchState after an awaited promise', async () => {
    const store = signalStore(
      withState({ data: null as number | null }),
      withMethods((s) => ({
        load: async () => {
          const data = await Promise.resolve(42);
          patchState(s, { data });
        },
      })),
    );

    await store.load();
    expect(store.data.value).toBe(42);
  });

  it('applies multiple sequential awaits in order', async () => {
    const store = signalStore(
      withState({ log: [] as number[] }),
      withMethods((s) => ({
        loadAll: async () => {
          for (const n of [1, 2, 3]) {
            const v = await Promise.resolve(n * 10);
            patchState(s, (state) => ({ log: [...state.log, v] }));
          }
        },
      })),
    );

    await store.loadAll();
    expect(store.log.value).toEqual([10, 20, 30]);
  });

  it('reads current state lazily after each await', async () => {
    const store = signalStore(
      withState({ count: 0 }),
      withMethods((s) => ({
        incTwiceAsync: async () => {
          await Promise.resolve();
          patchState(s, { count: s.count.value + 1 });
          await Promise.resolve();
          patchState(s, { count: s.count.value + 1 });
        },
      })),
    );

    await store.incTwiceAsync();
    expect(store.count.value).toBe(2);
  });

  it('skips patchState if destroyStore was called during the await', async () => {
    const store = signalStore(
      withState({ count: 0 }),
      withMethods((s) => ({
        loadAndPatch: async () => {
          const data = await Promise.resolve(99);
          patchState(s, { count: data });
        },
      })),
    );

    const promise = store.loadAndPatch();
    destroyStore(store);
    await promise;

    expect(store.count.value).toBe(0);
  });

  it('handles concurrent async methods correctly', async () => {
    const store = signalStore(
      withState({ a: 0, b: 0 }),
      withMethods((s) => ({
        loadA: async () => {
          const v = await Promise.resolve(7);
          patchState(s, { a: v });
        },
        loadB: async () => {
          const v = await Promise.resolve(13);
          patchState(s, { b: v });
        },
      })),
    );

    await Promise.all([store.loadA(), store.loadB()]);
    expect(store.a.value).toBe(7);
    expect(store.b.value).toBe(13);
  });
});
