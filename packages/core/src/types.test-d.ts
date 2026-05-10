import { computed, type ReadonlySignal, type Signal } from '@preact/signals-core';
import { describe, expectTypeOf, it } from 'vitest';
import { patchState } from './patch-state';
import { signalStore } from './signal-store';
import { withComputed } from './with-computed';
import { withMethods } from './with-methods';
import { withState } from './with-state';

describe('signalStore + withState type inference', () => {
  it('infers a signal per top-level key without manual annotation', () => {
    const store = signalStore(withState({ count: 0, name: 'foo' }));

    expectTypeOf(store.count).toEqualTypeOf<Signal<number>>();
    expectTypeOf(store.name).toEqualTypeOf<Signal<string>>();
  });

  it('preserves nested object types atomically as Signal<Obj>', () => {
    const store = signalStore(withState({ user: { id: 1, name: 'a' } }));

    expectTypeOf(store.user).toEqualTypeOf<Signal<{ id: number; name: string }>>();
  });

  it('infers union and array literal types correctly', () => {
    const store = signalStore(
      withState({ status: 'idle' as 'idle' | 'loading', tags: ['a', 'b'] }),
    );

    expectTypeOf(store.status).toEqualTypeOf<Signal<'idle' | 'loading'>>();
    expectTypeOf(store.tags).toEqualTypeOf<Signal<string[]>>();
  });
});

describe('patchState type inference', () => {
  it('accepts partial state matching the store keys', () => {
    const store = signalStore(withState({ a: 1, b: 'x' }));

    patchState(store, { a: 2 });
    patchState(store, { b: 'y' });
    patchState(store, { a: 2, b: 'y' });
  });

  it('accepts a function updater whose argument is the unwrapped state', () => {
    const store = signalStore(withState({ count: 0, name: 'foo' }));

    patchState(store, (s) => {
      expectTypeOf(s).toEqualTypeOf<{ count: number; name: string }>();
      return { count: s.count + 1 };
    });
  });

  it('rejects partial values whose types do not match the store', () => {
    const store = signalStore(withState({ a: 1 }));

    // @ts-expect-error — string is not assignable to number
    patchState(store, { a: 'wrong' });
  });
});

describe('withComputed type inference', () => {
  it('infers state signals as input without annotation', () => {
    signalStore(
      withState({ count: 0, name: 'foo' }),
      withComputed((input) => {
        expectTypeOf(input.count).toEqualTypeOf<Signal<number>>();
        expectTypeOf(input.name).toEqualTypeOf<Signal<string>>();
        return { double: computed(() => input.count.value * 2) };
      }),
    );
  });

  it('exposes computed signals on the final store as ReadonlySignal', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withComputed(({ count }) => ({
        double: computed(() => count.value * 2),
      })),
    );

    expectTypeOf(store.count).toEqualTypeOf<Signal<number>>();
    expectTypeOf(store.double).toEqualTypeOf<ReadonlySignal<number>>();
  });

  it('chained withComputed sees previous computed in input', () => {
    signalStore(
      withState({ count: 0 }),
      withComputed(({ count }) => ({
        double: computed(() => count.value * 2),
      })),
      withComputed((input) => {
        expectTypeOf(input.count).toEqualTypeOf<Signal<number>>();
        expectTypeOf(input.double).toEqualTypeOf<ReadonlySignal<number>>();
        return { quadruple: computed(() => input.double.value * 2) };
      }),
    );
  });
});

describe('withMethods type inference', () => {
  it('infers state + computed signals as input without annotation', () => {
    signalStore(
      withState({ count: 0 }),
      withComputed(({ count }) => ({
        double: computed(() => count.value * 2),
      })),
      withMethods((s) => {
        expectTypeOf(s.count).toEqualTypeOf<Signal<number>>();
        expectTypeOf(s.double).toEqualTypeOf<ReadonlySignal<number>>();
        return { inc: () => patchState(s, { count: s.count.value + 1 }) };
      }),
    );
  });

  it('exposes methods on the final store with correct signatures', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withMethods((s) => ({
        inc: () => patchState(s, { count: s.count.value + 1 }),
        add: (n: number) => patchState(s, { count: s.count.value + n }),
      })),
    );

    expectTypeOf(store.inc).toEqualTypeOf<() => void>();
    expectTypeOf(store.add).toEqualTypeOf<(n: number) => void>();
  });

  it('rejects calls with wrong argument types', () => {
    const store = signalStore(
      withState({ count: 0 }),
      withMethods((s) => ({
        add: (n: number) => patchState(s, { count: s.count.value + n }),
      })),
    );

    // @ts-expect-error — string is not assignable to number
    store.add('one');
    // @ts-expect-error — missing required argument
    store.add();
  });
});
