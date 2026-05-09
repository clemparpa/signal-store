import { computed } from '@preact/signals-core';
import { describe, expect, it } from 'vitest';
import { patchState } from './patch-state';
import { signalStore } from './signal-store';
import { withComputed } from './with-computed';
import { withMethods } from './with-methods';
import { withState } from './with-state';

describe('signalStore', () => {
  it('returns an empty object when no features are passed', () => {
    const store = signalStore();
    expect(store).toEqual({});
  });

  it('composes a single withState into signal slots', () => {
    const store = signalStore(withState({ count: 0, name: 'foo' }));

    expect(store.count.value).toBe(0);
    expect(store.name.value).toBe('foo');
  });

  it('exposes signals (not raw values) on the store', () => {
    const store = signalStore(withState({ count: 0 }));

    expect(typeof store.count.value).toBe('number');
    expect('value' in store.count).toBe(true);
  });

  it('composes state + computed + methods end-to-end', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withComputed(({ count }) => ({
        double: computed(() => count.value * 2),
      })),
      withMethods((s) => ({
        inc: () => patchState(s, { count: s.count.value + 1 }),
        reset: () => patchState(s, { count: 0 }),
      })),
    );

    store.inc();
    store.inc();
    expect(store.count.value).toBe(2);
    expect(store.double.value).toBe(4);

    store.reset();
    expect(store.count.value).toBe(0);
    expect(store.double.value).toBe(0);
  });

  it('throws when two withState declare the same key', () => {
    expect(() => signalStore(withState({ count: 0 }), withState({ count: 1 }))).toThrow(
      /duplicate key "count"/,
    );
  });

  it('throws when withComputed collides with a state key', () => {
    expect(() =>
      signalStore(
        withState({ x: 0 }),
        withComputed(() => ({ x: computed(() => 1) })),
      ),
    ).toThrow(/duplicate key "x"/);
  });

  it('throws when withMethods collides with a computed key', () => {
    expect(() =>
      signalStore(
        withState({ count: 0 }),
        withComputed(({ count }) => ({
          double: computed(() => count.value * 2),
        })),
        withMethods(() => ({ double: () => 0 })),
      ),
    ).toThrow(/duplicate key "double"/);
  });

  it('throws when withMethods collides with a state key', () => {
    expect(() =>
      signalStore(
        withState({ inc: 0 }),
        withMethods(() => ({ inc: () => undefined })),
      ),
    ).toThrow(/duplicate key "inc"/);
  });
});
