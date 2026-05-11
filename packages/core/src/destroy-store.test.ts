import { describe, expect, it, vi } from 'vitest';
import { destroyStore } from './destroy-store';
import { patchState } from './patch-state';
import { signalStore } from './signal-store';
import { getMeta } from './store-meta';
import { withState } from './with-state';

describe('destroyStore', () => {
  it('is a no-op on a store without meta', () => {
    const plain = { a: 1 };
    expect(() => destroyStore(plain)).not.toThrow();
  });

  it('silences patchState after destroy (no signal update, no throw)', () => {
    const store = signalStore(withState({ count: 0 }));

    destroyStore(store);

    expect(() => patchState(store, { count: 99 })).not.toThrow();
    expect(store.count.value).toBe(0);
  });

  it('closes the cleanup Subscription after destroy', () => {
    const store = signalStore(withState({ count: 0 }));
    const meta = getMeta(store);

    expect(meta?.cleanup.closed).toBe(false);

    destroyStore(store);

    expect(meta?.cleanup.closed).toBe(true);
  });

  it('is idempotent (double destroy does not crash)', () => {
    const store = signalStore(withState({ count: 0 }));

    destroyStore(store);
    expect(() => destroyStore(store)).not.toThrow();
  });

  it('preserves signal last values after destroy (post-mortem snapshot)', () => {
    const store = signalStore(withState({ count: 0, name: 'foo' }));
    patchState(store, { count: 42, name: 'bar' });
    const snapshotBefore = { count: store.count.value, name: store.name.value };

    destroyStore(store);

    expect(store.count.value).toBe(snapshotBefore.count);
    expect(store.name.value).toBe(snapshotBefore.name);
  });

  it('stops re-subscribing signals to mutations after destroy', () => {
    const store = signalStore(withState({ count: 0 }));
    const subscriber = vi.fn();

    destroyStore(store);

    // post-destroy: subscribers on store.count are still functional as raw signals,
    // but no new value can flow because mutations$ is completed.
    store.count.subscribe(subscriber);
    subscriber.mockClear();
    patchState(store, { count: 7 });

    expect(subscriber).not.toHaveBeenCalled();
    expect(store.count.value).toBe(0);
  });
});
