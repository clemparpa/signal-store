import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyStore } from './destroy-store';
import { toSignal } from './rx-method';
import { signalStore } from './signal-store';
import { withState } from './with-state';

describe('toSignal — standalone variant', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads `initial` synchronously before any emission', () => {
    const source$ = new Subject<number>();
    const [sig, dispose] = toSignal(source$, 42);

    expect(sig.value).toBe(42);
    dispose();
  });

  it('updates the signal on each `next`', () => {
    const source$ = new Subject<number>();
    const [sig, dispose] = toSignal(source$, 0);

    source$.next(1);
    expect(sig.value).toBe(1);

    source$.next(2);
    expect(sig.value).toBe(2);

    dispose();
  });

  it('pulls the current value from a BehaviorSubject synchronously on subscribe', () => {
    const source$ = new BehaviorSubject<number>(7);
    const [sig, dispose] = toSignal(source$, 0);

    expect(sig.value).toBe(7);
    dispose();
  });

  it('routes Observable errors to console.error and keeps the last value', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const source$ = new Subject<number>();
    const [sig] = toSignal(source$, 0);

    source$.next(10);
    expect(sig.value).toBe(10);

    source$.error(new Error('boom'));
    expect(sig.value).toBe(10);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[1]).toBeInstanceOf(Error);
  });

  it('handles a synchronously-erroring Observable without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const [sig] = toSignal(
      throwError(() => new Error('sync')),
      'fallback',
    );

    expect(sig.value).toBe('fallback');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('keeps the last value on `complete`', () => {
    const source$ = new Subject<number>();
    const [sig, dispose] = toSignal(source$, 0);

    source$.next(5);
    source$.complete();

    expect(sig.value).toBe(5);
    dispose();
  });

  it('dispose() stops future emissions from the source', () => {
    const source$ = new Subject<number>();
    const [sig, dispose] = toSignal(source$, 0);

    source$.next(1);
    dispose();
    source$.next(2);

    expect(sig.value).toBe(1);
  });

  it('dispose() is idempotent (RxJS Subscription.unsubscribe is a no-op on second call)', () => {
    const source$ = new Subject<number>();
    const [, dispose] = toSignal(source$, 0);

    dispose();
    expect(() => dispose()).not.toThrow();
  });

  it('returns a [signal, dispose] tuple', () => {
    const source$ = new Subject<number>();
    const result = toSignal(source$, 0);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(typeof result[1]).toBe('function');
    result[1]();
  });
});

describe('toSignal — store-aware variant', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads `initial` synchronously before any emission', () => {
    const store = signalStore(withState({ tick: 0 }));
    const source$ = new Subject<number>();

    const sig = toSignal(store, source$, 99);
    expect(sig.value).toBe(99);
  });

  it('updates the signal on each `next`', () => {
    const store = signalStore(withState({ tick: 0 }));
    const source$ = new Subject<number>();
    const sig = toSignal(store, source$, 0);

    source$.next(1);
    source$.next(2);

    expect(sig.value).toBe(2);
  });

  it('stops receiving emissions after destroyStore', () => {
    const store = signalStore(withState({ tick: 0 }));
    const source$ = new Subject<number>();
    const sig = toSignal(store, source$, 0);

    source$.next(5);
    expect(sig.value).toBe(5);

    destroyStore(store);
    source$.next(99);
    expect(sig.value).toBe(5);
  });

  it('returns a signal at `initial` without subscribing when called on a destroyed store', () => {
    const store = signalStore(withState({ tick: 0 }));
    destroyStore(store);

    const source$ = new Subject<number>();
    const subscribeSpy = vi.spyOn(source$, 'subscribe');

    const sig = toSignal(store, source$, 7);
    expect(sig.value).toBe(7);
    expect(subscribeSpy).not.toHaveBeenCalled();
  });

  it('throws when the first argument is not a signalStore', () => {
    const source$ = new Subject<number>();
    expect(() => toSignal({}, source$, 0)).toThrow(/signalStore/);
  });

  it('routes Observable errors to console.error and keeps the last value', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = signalStore(withState({ tick: 0 }));
    const source$ = new Subject<number>();
    const sig = toSignal(store, source$, 0);

    source$.next(10);
    source$.error(new Error('boom'));

    expect(sig.value).toBe(10);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('does not leak: an errored subscription auto-detaches from meta.cleanup', () => {
    // Indirect check: after a child sub errors, the store can still be destroyed
    // cleanly and other toSignal calls keep working. This exercises the
    // registerOnCleanup auto-detach branch.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = signalStore(withState({ tick: 0 }));
    const errored$ = new Subject<number>();
    const live$ = new Subject<number>();

    toSignal(store, errored$, 0);
    const live = toSignal(store, live$, 0);

    errored$.error(new Error('child boom'));
    live$.next(3);

    expect(live.value).toBe(3);
    expect(spy).toHaveBeenCalledOnce();

    expect(() => destroyStore(store)).not.toThrow();
  });

  it('keeps emitting after a sibling toSignal call (multiple subscriptions on one store)', () => {
    const store = signalStore(withState({ tick: 0 }));
    const a$ = new Subject<number>();
    const b$ = new Subject<string>();

    const a = toSignal(store, a$, 0);
    const b = toSignal(store, b$, '');

    a$.next(1);
    b$.next('x');
    a$.next(2);

    expect(a.value).toBe(2);
    expect(b.value).toBe('x');
  });

  it('plays well with a cold Observable that synchronously emits on subscribe', () => {
    const store = signalStore(withState({ tick: 0 }));
    const cold$ = new Observable<number>((subscriber) => {
      subscriber.next(123);
    });

    const sig = toSignal(store, cold$, 0);
    expect(sig.value).toBe(123);
  });
});
