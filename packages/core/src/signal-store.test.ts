import { describe, expect, it } from 'vitest';
import { signalStore } from './signal-store';
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
});
