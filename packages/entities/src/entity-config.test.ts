import { describe, expect, it } from 'vitest';
import { entityConfig } from './entity-config';

describe('entityConfig', () => {
  it('defaults to id-based selector and empty collection', () => {
    const cfg = entityConfig<{ id: string; name: string }>();
    expect(cfg.collection).toBe('');
    expect(cfg.selectId({ id: 'abc', name: 'x' })).toBe('abc');
  });

  it('honours a custom selectId', () => {
    const cfg = entityConfig<{ uuid: string }>({ selectId: (u) => u.uuid });
    expect(cfg.selectId({ uuid: 'xyz' })).toBe('xyz');
  });

  it('propagates the collection name', () => {
    const cfg = entityConfig<{ id: string }, 'users'>({ collection: 'users' });
    expect(cfg.collection).toBe('users');
  });

  it('supports both options together', () => {
    const cfg = entityConfig<{ uuid: string }, 'users'>({
      collection: 'users',
      selectId: (u) => u.uuid,
    });
    expect(cfg.collection).toBe('users');
    expect(cfg.selectId({ uuid: 'abc' })).toBe('abc');
  });

  it('accepts numeric ids', () => {
    const cfg = entityConfig<{ id: number }>();
    expect(cfg.selectId({ id: 42 })).toBe(42);
  });
});
