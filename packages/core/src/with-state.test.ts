import { describe, expect, it } from 'vitest';
import { withState } from './with-state';

describe('withState', () => {
  it('creates one signal per top-level key', () => {
    const feature = withState({ count: 0, name: 'foo' });
    const out = feature({});

    expect(Object.keys(out).sort()).toEqual(['count', 'name']);
    expect(out.count.value).toBe(0);
    expect(out.name.value).toBe('foo');
  });

  it('preserves nested objects atomically (no deep signal conversion)', () => {
    const feature = withState({ user: { name: 'foo', age: 30 } });
    const out = feature({});

    expect(out.user.value).toEqual({ name: 'foo', age: 30 });
  });

  it('freezes initial values in dev', () => {
    const feature = withState({ user: { name: 'foo' } });
    const out = feature({});

    expect(Object.isFrozen(out.user.value)).toBe(true);
    expect(() => {
      (out.user.value as { name: string }).name = 'bar';
    }).toThrow(TypeError);
  });

  it('handles primitive and array values', () => {
    const feature = withState({ count: 1, tags: ['a', 'b'], flag: true });
    const out = feature({});

    expect(out.count.value).toBe(1);
    expect(out.tags.value).toEqual(['a', 'b']);
    expect(out.flag.value).toBe(true);
    expect(Object.isFrozen(out.tags.value)).toBe(true);
  });

  it('handles null and undefined values without crashing the freeze', () => {
    const feature = withState({ a: null, b: undefined, c: 0 });
    const out = feature({});

    expect(out.a.value).toBeNull();
    expect(out.b.value).toBeUndefined();
    expect(out.c.value).toBe(0);
  });

  it('does not infinite-loop on circular references', () => {
    type Cyclic = { name: string; self?: Cyclic };
    const a: Cyclic = { name: 'foo' };
    a.self = a;

    const feature = withState({ obj: a });
    const out = feature({});

    expect(out.obj.value.name).toBe('foo');
    expect(out.obj.value.self).toBe(out.obj.value);
    expect(Object.isFrozen(out.obj.value)).toBe(true);
  });
});
