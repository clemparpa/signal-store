import { computed, effect } from '@preact/signals-core';
import { describe, expect, it, vi } from 'vitest';
import { patchState } from './patch-state';
import { signalStore } from './signal-store';
import { withComputed } from './with-computed';
import { withState } from './with-state';

describe('withComputed', () => {
  it('exposes a computed derived from a state signal', () => {
    const store = signalStore(
      withState({ count: 2 }),
      withComputed(({ count }) => ({
        double: computed(() => count.value * 2),
      })),
    );

    expect(store.double.value).toBe(4);
  });

  it('updates the computed value when the state changes', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withComputed(({ count }) => ({
        double: computed(() => count.value * 2),
      })),
    );

    patchState(store, { count: 5 });

    expect(store.double.value).toBe(10);
  });

  it('passes the previously declared signals to fn', () => {
    const store = signalStore(
      withState({ a: 1, b: 2 }),
      withComputed((input) => {
        expect(input.a.value).toBe(1);
        expect(input.b.value).toBe(2);
        return { sum: computed(() => input.a.value + input.b.value) };
      }),
    );

    expect(store.sum.value).toBe(3);
  });

  it('chains: a second withComputed sees the first computed', () => {
    const store = signalStore(
      withState({ count: 1 }),
      withComputed(({ count }) => ({
        double: computed(() => count.value * 2),
      })),
      withComputed(({ double }) => ({
        quadruple: computed(() => double.value * 2),
      })),
    );

    expect(store.quadruple.value).toBe(4);

    patchState(store, { count: 3 });

    expect(store.double.value).toBe(6);
    expect(store.quadruple.value).toBe(12);
  });

  it('triggers effects subscribed to the computed when state changes', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withComputed(({ count }) => ({
        double: computed(() => count.value * 2),
      })),
    );
    const subscriber = vi.fn();

    const dispose = effect(() => {
      subscriber(store.double.value);
    });
    subscriber.mockClear();

    patchState(store, { count: 4 });

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith(8);
    dispose();
  });

  it('exposes multiple computed signals from a single withComputed call', () => {
    const store = signalStore(
      withState({ a: 2, b: 3 }),
      withComputed(({ a, b }) => ({
        sum: computed(() => a.value + b.value),
        product: computed(() => a.value * b.value),
        squareA: computed(() => a.value * a.value),
      })),
    );

    expect(store.sum.value).toBe(5);
    expect(store.product.value).toBe(6);
    expect(store.squareA.value).toBe(4);

    patchState(store, { a: 10 });

    expect(store.sum.value).toBe(13);
    expect(store.product.value).toBe(30);
    expect(store.squareA.value).toBe(100);
  });

  it('a computed depending on multiple state signals reacts to any of them', () => {
    const store = signalStore(
      withState({ x: 1, y: 2, z: 3 }),
      withComputed(({ x, y, z }) => ({
        total: computed(() => x.value + y.value + z.value),
      })),
    );

    expect(store.total.value).toBe(6);

    patchState(store, { x: 10 });
    expect(store.total.value).toBe(15);

    patchState(store, { y: 20 });
    expect(store.total.value).toBe(33);

    patchState(store, { z: 30 });
    expect(store.total.value).toBe(60);
  });

  it('does not re-evaluate the computed body when an unrelated state changes', () => {
    const evalSpy = vi.fn();
    const store = signalStore(
      withState({ a: 1, b: 100 }),
      withComputed(({ a }) => ({
        doubleA: computed(() => {
          evalSpy();
          return a.value * 2;
        }),
      })),
    );

    expect(store.doubleA.value).toBe(2);
    expect(evalSpy).toHaveBeenCalledTimes(1);

    patchState(store, { b: 200 });
    expect(store.doubleA.value).toBe(2);
    expect(evalSpy).toHaveBeenCalledTimes(1);

    patchState(store, { a: 5 });
    expect(store.doubleA.value).toBe(10);
    expect(evalSpy).toHaveBeenCalledTimes(2);
  });
});
