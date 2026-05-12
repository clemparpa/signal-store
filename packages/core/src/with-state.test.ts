import { describe, expect, it } from 'vitest';
import { signalStore } from './signal-store';
import { withState } from './with-state';

describe('withState', () => {
  it('creates one signal per top-level key', () => {
    const store = signalStore(withState({ count: 0, name: 'foo' }));

    expect(store.count.value).toBe(0);
    expect(store.name.value).toBe('foo');
  });

  it('preserves nested objects atomically (no deep signal conversion)', () => {
    const store = signalStore(withState({ user: { name: 'foo', age: 30 } }));

    expect(store.user.value).toEqual({ name: 'foo', age: 30 });
  });

  it('freezes initial values in dev', () => {
    const store = signalStore(withState({ user: { name: 'foo' } as { name: string } }));

    expect(Object.isFrozen(store.user.value)).toBe(true);
    expect(() => {
      store.user.value.name = 'bar';
    }).toThrow(TypeError);
  });

  it('handles primitive and array values', () => {
    const store = signalStore(withState({ count: 1, tags: ['a', 'b'], flag: true }));

    expect(store.count.value).toBe(1);
    expect(store.tags.value).toEqual(['a', 'b']);
    expect(store.flag.value).toBe(true);
    expect(Object.isFrozen(store.tags.value)).toBe(true);
  });

  it('handles null and undefined values without crashing the freeze', () => {
    const store = signalStore(withState({ a: null as null, b: undefined as undefined, c: 0 }));

    expect(store.a.value).toBeNull();
    expect(store.b.value).toBeUndefined();
    expect(store.c.value).toBe(0);
  });

  it('does not infinite-loop on circular references', () => {
    type Cyclic = { name: string; self?: Cyclic };
    const a: Cyclic = { name: 'foo' };
    a.self = a;

    const store = signalStore(withState({ obj: a }));

    expect(store.obj.value.name).toBe('foo');
    expect(store.obj.value.self).toBe(store.obj.value);
    expect(Object.isFrozen(store.obj.value)).toBe(true);
  });

  it('throws when used outside signalStore', () => {
    const feature = withState({ count: 0 });
    expect(() => feature({})).toThrow(/signalStore/);
  });
});
