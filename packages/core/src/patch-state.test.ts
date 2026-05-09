import { effect } from '@preact/signals-core';
import { describe, expect, it, vi } from 'vitest';
import { patchState } from './patch-state';
import { signalStore } from './signal-store';
import { withState } from './with-state';

describe('patchState', () => {
  it('applies a partial object update', () => {
    const store = signalStore(withState({ count: 0, name: 'foo' }));

    patchState(store, { count: 1 });

    expect(store.count.value).toBe(1);
    expect(store.name.value).toBe('foo');
  });

  it('applies a function updater receiving the current state', () => {
    const store = signalStore(withState({ count: 5 }));

    patchState(store, (s) => ({ count: s.count + 1 }));

    expect(store.count.value).toBe(6);
  });

  it('applies multiple variadic updates in order', () => {
    const store = signalStore(withState({ count: 0 }));

    patchState(store, { count: 1 }, (s) => ({ count: s.count + 10 }), { count: 100 });

    expect(store.count.value).toBe(100);
  });

  it('does not notify subscribers of keys not present in the partial', () => {
    const store = signalStore(withState({ count: 0, name: 'foo' }));
    const nameSubscriber = vi.fn();

    const dispose = effect(() => {
      nameSubscriber(store.name.value);
    });
    nameSubscriber.mockClear();

    patchState(store, { count: 1 });

    expect(nameSubscriber).not.toHaveBeenCalled();
    dispose();
  });

  it('freezes object values set via patchState in dev', () => {
    const store = signalStore(withState({ user: { name: 'foo' } as { name: string } }));

    patchState(store, { user: { name: 'bar' } });

    expect(Object.isFrozen(store.user.value)).toBe(true);
    expect(() => {
      store.user.value.name = 'baz';
    }).toThrow(TypeError);
  });

  it('ignores keys not declared on the store', () => {
    const store = signalStore(withState({ count: 0 }));

    patchState(store, { count: 1, foo: 'bar' } as { count: number; foo: string });

    expect(store.count.value).toBe(1);
    expect('foo' in store).toBe(false);
  });

  it('notifies subscribers of keys actually patched (positive reactivity)', () => {
    const store = signalStore(withState({ count: 0 }));
    const subscriber = vi.fn();

    const dispose = effect(() => {
      subscriber(store.count.value);
    });
    subscriber.mockClear();

    patchState(store, { count: 1 });

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith(1);
    dispose();
  });

  it('is a no-op when called with no updates', () => {
    const store = signalStore(withState({ count: 0, name: 'foo' }));
    const subscriber = vi.fn();

    const dispose = effect(() => {
      subscriber(store.count.value, store.name.value);
    });
    subscriber.mockClear();

    patchState(store);

    expect(store.count.value).toBe(0);
    expect(store.name.value).toBe('foo');
    expect(subscriber).not.toHaveBeenCalled();
    dispose();
  });

  it('is a no-op with an empty partial', () => {
    const store = signalStore(withState({ count: 0 }));
    const subscriber = vi.fn();

    const dispose = effect(() => {
      subscriber(store.count.value);
    });
    subscriber.mockClear();

    patchState(store, {});

    expect(store.count.value).toBe(0);
    expect(subscriber).not.toHaveBeenCalled();
    dispose();
  });

  it('does not re-notify on referentially identical value', () => {
    const sharedRef = { name: 'foo' };
    const store = signalStore(withState({ ref: sharedRef as { name: string } }));
    const subscriber = vi.fn();

    const dispose = effect(() => {
      subscriber(store.ref.value);
    });
    subscriber.mockClear();

    patchState(store, { ref: sharedRef });

    expect(subscriber).not.toHaveBeenCalled();
    dispose();
  });

  it('handles circular references in patched values without infinite loop', () => {
    type Cyclic = { name: string; self?: Cyclic };
    const store = signalStore(withState({ obj: { name: 'init' } as Cyclic }));

    const next: Cyclic = { name: 'next' };
    next.self = next;

    patchState(store, { obj: next });

    expect(store.obj.value.name).toBe('next');
    expect(store.obj.value.self).toBe(store.obj.value);
    expect(Object.isFrozen(store.obj.value)).toBe(true);
  });
});
