import type { Signal } from '@preact/signals-core';
import { describe, expectTypeOf, it } from 'vitest';
import { patchState } from './patch-state';
import { signalStore } from './signal-store';
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
