import { computed, signal } from '@preact/signals-core';
import { EMPTY, interval, of, Subject, Subscription, throwError, timer } from 'rxjs';
import { catchError, debounceTime, map, switchMap, take, tap } from 'rxjs/operators';
import { describe, expect, it, vi } from 'vitest';
import { destroyStore } from './destroy-store';
import { patchState } from './patch-state';
import { rxMethod, toObservable } from './rx-method';
import { signalStore } from './signal-store';
import { withMethods } from './with-methods';
import { withState } from './with-state';

describe('rxMethod — input shapes', () => {
  it('pushes a scalar input through the pipeline', () => {
    const store = signalStore(
      withState({ last: '' }),
      withMethods((s) => ({
        emit: rxMethod<string>(s, (in$) => in$.pipe(tap((v) => patchState(s, { last: v })))),
      })),
    );

    store.emit('hello');
    expect(store.last.value).toBe('hello');
  });

  it('re-fires the pipeline on every change of a signal input', () => {
    const seen: number[] = [];
    const store = signalStore(
      withMethods((s) => ({
        watch: rxMethod<number>(s, (in$) => in$.pipe(tap((v) => seen.push(v)))),
      })),
    );

    const source = signal(1);
    store.watch(source);
    source.value = 2;
    source.value = 3;

    expect(seen).toEqual([1, 2, 3]);
  });

  it('forwards every emission of an observable input', () => {
    const seen: string[] = [];
    const store = signalStore(
      withMethods((s) => ({
        watch: rxMethod<string>(s, (in$) => in$.pipe(tap((v) => seen.push(v)))),
      })),
    );

    store.watch(of('a', 'b', 'c'));

    expect(seen).toEqual(['a', 'b', 'c']);
  });
});

describe('rxMethod — stateful operators across invocations', () => {
  it('debounces calls through a shared pipeline', () => {
    vi.useFakeTimers();
    try {
      const seen: number[] = [];
      const store = signalStore(
        withMethods((s) => ({
          search: rxMethod<number>(s, (in$) =>
            in$.pipe(
              debounceTime(50),
              tap((v) => seen.push(v)),
            ),
          ),
        })),
      );

      store.search(1);
      store.search(2);
      store.search(3);

      vi.advanceTimersByTime(49);
      expect(seen).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(seen).toEqual([3]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('rxMethod — cleanup', () => {
  it('tears down a running observable input on destroyStore', () => {
    vi.useFakeTimers();
    try {
      const seen: number[] = [];
      const store = signalStore(
        withMethods((s) => ({
          tick: rxMethod<number>(s, (in$) => in$.pipe(tap((v) => seen.push(v)))),
        })),
      );

      store.tick(interval(10));

      vi.advanceTimersByTime(35);
      const before = seen.length;
      expect(before).toBeGreaterThan(0);

      destroyStore(store);

      vi.advanceTimersByTime(100);
      expect(seen.length).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('is a silent no-op when invoked after destroyStore', () => {
    const seen: number[] = [];
    const store = signalStore(
      withMethods((s) => ({
        emit: rxMethod<number>(s, (in$) => in$.pipe(tap((v) => seen.push(v)))),
      })),
    );

    destroyStore(store);

    const sub = store.emit(42);
    expect(sub).toBe(Subscription.EMPTY);
    expect(seen).toEqual([]);
  });

  it('returns a Subscription that can be unsubscribed manually to stop a signal binding', () => {
    const seen: number[] = [];
    const store = signalStore(
      withMethods((s) => ({
        watch: rxMethod<number>(s, (in$) => in$.pipe(tap((v) => seen.push(v)))),
      })),
    );

    const source = signal(10);
    const sub = store.watch(source);
    expect(seen).toEqual([10]);

    sub.unsubscribe();
    source.value = 20;
    source.value = 30;

    expect(seen).toEqual([10]);
  });

  it('throws when called with an object that is not a signalStore', () => {
    expect(() => rxMethod({}, (in$) => in$)).toThrow(/signalStore/);
  });
});

describe('toObservable', () => {
  it('emits the current value synchronously on subscribe, then every change', () => {
    const seen: number[] = [];
    const source = signal(1);

    const sub = toObservable(source).subscribe((v) => seen.push(v));

    expect(seen).toEqual([1]);

    source.value = 2;
    source.value = 3;
    expect(seen).toEqual([1, 2, 3]);

    sub.unsubscribe();
  });

  it('releases the underlying signal subscription on unsubscribe', () => {
    const seen: number[] = [];
    const source = signal(1);

    const sub = toObservable(source).subscribe((v) => seen.push(v));
    sub.unsubscribe();

    source.value = 99;
    expect(seen).toEqual([1]);
  });
});

describe('rxMethod — realistic composition', () => {
  it('drives a debounced + mapped pipeline that writes back via patchState', () => {
    vi.useFakeTimers();
    try {
      const store = signalStore(
        withState({ query: '', upper: '' }),
        withMethods((s) => ({
          setQuery: rxMethod<string>(s, (q$) =>
            q$.pipe(
              tap((q) => patchState(s, { query: q })),
              debounceTime(100),
              map((q) => q.toUpperCase()),
              tap((u) => patchState(s, { upper: u })),
            ),
          ),
        })),
      );

      store.setQuery('foo');
      store.setQuery('foobar');
      expect(store.query.value).toBe('foobar');
      expect(store.upper.value).toBe('');

      vi.advanceTimersByTime(100);
      expect(store.upper.value).toBe('FOOBAR');
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes a finite slice of an observable input via take()', () => {
    const seen: number[] = [];
    const source$ = new Subject<number>();
    const store = signalStore(
      withMethods((s) => ({
        firstTwo: rxMethod<number>(s, (in$) =>
          in$.pipe(
            take(2),
            tap((v) => seen.push(v)),
          ),
        ),
      })),
    );

    store.firstTwo(source$);
    source$.next(1);
    source$.next(2);
    source$.next(3);
    source$.next(4);

    expect(seen).toEqual([1, 2]);
  });
});

describe('rxMethod — RxJS edge cases', () => {
  it('switchMap cancels the previous in-flight inner observable', () => {
    vi.useFakeTimers();
    try {
      const completed: string[] = [];
      const store = signalStore(
        withMethods((s) => ({
          load: rxMethod<string>(s, (id$) =>
            id$.pipe(
              switchMap((id) => timer(100).pipe(map(() => id))),
              tap((id) => completed.push(id)),
            ),
          ),
        })),
      );

      store.load('a');
      vi.advanceTimersByTime(50);
      store.load('b');
      vi.advanceTimersByTime(50);

      // 'a' should have been cancelled at t=50 by 'b'; only 'b' completes
      expect(completed).toEqual([]);

      vi.advanceTimersByTime(50);
      expect(completed).toEqual(['b']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('catchError inside the pipeline recovers and keeps the pipeline alive', () => {
    const seen: string[] = [];
    const errors: string[] = [];
    const store = signalStore(
      withMethods((s) => ({
        process: rxMethod<string>(s, (in$) =>
          in$.pipe(
            switchMap((v) =>
              v === 'boom'
                ? throwError(() => new Error('boom')).pipe(
                    catchError((e: Error) => {
                      errors.push(e.message);
                      return EMPTY;
                    }),
                  )
                : of(v),
            ),
            tap((v) => seen.push(v)),
          ),
        ),
      })),
    );

    store.process('a');
    store.process('boom');
    store.process('b');

    expect(seen).toEqual(['a', 'b']);
    expect(errors).toEqual(['boom']);
  });

  it('keeps multiple rxMethods on the same store fully isolated', () => {
    const seenA: number[] = [];
    const seenB: number[] = [];
    const store = signalStore(
      withMethods((s) => ({
        a: rxMethod<number>(s, (in$) => in$.pipe(tap((v) => seenA.push(v)))),
        b: rxMethod<number>(s, (in$) => in$.pipe(tap((v) => seenB.push(v)))),
      })),
    );

    store.a(1);
    store.a(2);
    store.b(99);

    expect(seenA).toEqual([1, 2]);
    expect(seenB).toEqual([99]);
  });

  it('keeps the pipeline alive after a finite observable source completes', () => {
    const seen: number[] = [];
    const store = signalStore(
      withMethods((s) => ({
        load: rxMethod<number>(s, (in$) => in$.pipe(tap((v) => seen.push(v)))),
      })),
    );

    // First invocation: finite observable that completes
    store.load(of(1, 2));
    expect(seen).toEqual([1, 2]);

    // Pipeline must stay alive — second invocation still fires
    store.load(10);
    store.load(of(20, 30));
    expect(seen).toEqual([1, 2, 10, 20, 30]);
  });

  it('accepts a ReadonlySignal (computed) as input', () => {
    const seen: number[] = [];
    const store = signalStore(
      withMethods((s) => ({
        watch: rxMethod<number>(s, (in$) => in$.pipe(tap((v) => seen.push(v)))),
      })),
    );

    const base = signal(1);
    const doubled = computed(() => base.value * 2);
    store.watch(doubled);
    expect(seen).toEqual([2]);

    base.value = 5;
    expect(seen).toEqual([2, 10]);
  });
});
