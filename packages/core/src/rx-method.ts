import { type ReadonlySignal, Signal, signal } from '@preact/signals-core';
import { Observable, Subject, Subscription } from 'rxjs';
import { getMeta, type StoreMeta } from './store-meta';

/**
 * Convert a Preact signal into a cold RxJS `Observable`.
 *
 * On subscribe, the returned Observable immediately emits the signal's current
 * value (Preact's `subscribe` semantics fire synchronously with the current
 * value) and then every subsequent change. Unsubscribing releases the signal
 * subscription.
 *
 * Useful when composing a signal into a wider RxJS pipeline (e.g. combining
 * two signals with `combineLatest`) outside of {@link rxMethod}.
 *
 * @param sig — the signal (writable or readonly) to wrap.
 * @example
 * ```ts
 * import { signal } from '@preact/signals-core';
 * import { toObservable } from '@fluch/signal-store';
 *
 * const count = signal(0);
 * const sub = toObservable(count).subscribe((v) => console.log(v));
 * // logs 0 immediately, then logs each new value
 * count.value = 1; // logs 1
 * sub.unsubscribe();
 * ```
 */
export function toObservable<T>(sig: Signal<T> | ReadonlySignal<T>): Observable<T> {
  return new Observable<T>((subscriber) => {
    const unsub = sig.subscribe((v) => {
      subscriber.next(v);
    });
    return unsub;
  });
}

/**
 * Convert an RxJS `Observable` into a Preact `ReadonlySignal`. The inverse of
 * {@link toObservable}.
 *
 * Two overloads:
 *
 * - **Standalone**: `toSignal(source, initial)` — returns a tuple
 *   `[ReadonlySignal<T>, dispose]` in the style of React hooks. The caller is
 *   responsible for calling `dispose()` to release the inner subscription.
 *   `dispose()` is idempotent (RxJS `Subscription.unsubscribe` is a no-op on
 *   subsequent calls).
 *
 * - **Store-aware**: `toSignal(store, source, initial)` — returns a plain
 *   `ReadonlySignal<T>`. The inner subscription is registered on the store's
 *   internal cleanup, so {@link destroyStore} (or the React `<Provider>`
 *   unmount) tears it down automatically. If the store is already destroyed
 *   when `toSignal` is called, returns a signal at `initial` without
 *   subscribing (silent no-op, mirroring {@link rxMethod}).
 *
 * Behavior shared by both variants:
 * - `signal.value = initial` synchronously at call time, before any emission.
 * - Each `next` from the source updates `signal.value`.
 * - On `error`, the error is reported via `console.error` and the signal keeps
 *   its last value — the signal never throws.
 * - On `complete`, the signal keeps its last value and the inner subscription
 *   is released.
 *
 * @example Standalone
 * ```ts
 * import { interval, take } from 'rxjs';
 * import { toSignal } from '@fluch/signal-store';
 *
 * const [counter, disposeCounter] = toSignal(interval(100).pipe(take(3)), -1);
 * counter.value; // -1
 * // ...after 300ms: counter.value === 2
 * disposeCounter(); // release the inner subscription
 * ```
 *
 * @example Store-aware
 * ```ts
 * import { signalStore, withState, withMethods, toSignal } from '@fluch/signal-store';
 * import { fromEvent, map } from 'rxjs';
 *
 * const store = signalStore(
 *   withState({ ready: false }),
 *   withMethods((s) => ({
 *     bindWidth: () => {
 *       const width = toSignal(
 *         s,
 *         fromEvent(window, 'resize').pipe(map(() => window.innerWidth)),
 *         window.innerWidth,
 *       );
 *       // width.value reflects the latest innerWidth; cleanup is automatic
 *       return width;
 *     },
 *   })),
 * );
 * ```
 */
export function toSignal<T>(
  source: Observable<T>,
  initial: T,
): readonly [ReadonlySignal<T>, () => void];
export function toSignal<T>(store: object, source: Observable<T>, initial: T): ReadonlySignal<T>;
export function toSignal<T>(
  storeOrSource: object | Observable<T>,
  sourceOrInitial: Observable<T> | T,
  maybeInitial?: T,
): ReadonlySignal<T> | readonly [ReadonlySignal<T>, () => void] {
  if (storeOrSource instanceof Observable) {
    const source = storeOrSource;
    const initial = sourceOrInitial as T;
    const sig = signal<T>(initial);
    const sub = source.subscribe({
      next: (v) => {
        sig.value = v;
      },
      error: (err) => {
        console.error('[toSignal] Observable errored:', err);
      },
    });
    return [sig as ReadonlySignal<T>, () => sub.unsubscribe()] as const;
  }

  const store = storeOrSource;
  const source = sourceOrInitial as Observable<T>;
  const initial = maybeInitial as T;
  const meta = getMeta(store);
  if (meta === undefined) {
    throw new Error('toSignal must be called with a signalStore(...) instance');
  }

  const sig = signal<T>(initial);
  if (meta.cleanup.closed) {
    return sig as ReadonlySignal<T>;
  }

  const sub = source.subscribe({
    next: (v) => {
      sig.value = v;
    },
    error: (err) => {
      console.error('[toSignal] Observable errored:', err);
    },
  });
  registerOnCleanup(meta, sub);

  return sig as ReadonlySignal<T>;
}

/**
 * A method produced by {@link rxMethod}. Accepts a scalar value, a Preact
 * signal, or an RxJS `Observable` and forwards it into the underlying
 * pipeline. Returns the `Subscription` for the source binding (or
 * `Subscription.EMPTY` for scalar invocations and post-destroy calls).
 */
export type RxMethod<Input> = (
  input: Input | Signal<Input> | ReadonlySignal<Input> | Observable<Input>,
) => Subscription;

function registerOnCleanup(meta: StoreMeta, sub: Subscription): void {
  meta.cleanup.add(sub);
  // Auto-detach when the child ends (manual unsubscribe, source completion,
  // or error) so long-lived stores with many invocations don't accumulate
  // closed references on meta.cleanup.
  sub.add(() => meta.cleanup.remove(sub));
}

/**
 * Create a managed RxJS-powered method on a store.
 *
 * `rxMethod` wires a single shared `Subject<Input>` through the
 * user-provided `generator` (typically a `pipe(...)` chain) and subscribes
 * once. Every invocation of the returned function pushes a value into that
 * same Subject — so stateful operators like `debounceTime`, `switchMap`,
 * `concatMap`, etc., behave correctly across calls.
 *
 * The pipeline subscription is added to the store's internal cleanup, so
 * `destroyStore(store)` (or the React Provider's unmount) tears it down
 * automatically. After destruction the method becomes a silent no-op,
 * mirroring the post-destroy semantics of {@link patchState}.
 *
 * The returned method accepts three input shapes:
 * - a plain value `Input` — pushed once into the pipeline.
 * - a Preact `Signal<Input>` / `ReadonlySignal<Input>` — its current value is
 *   pushed immediately, and every subsequent change is pushed too. The
 *   binding lives until `destroyStore` or until the caller unsubscribes the
 *   returned `Subscription`.
 * - an RxJS `Observable<Input>` — every emission is forwarded; completion of
 *   the source does not complete the pipeline. The binding is registered on
 *   the store cleanup like the signal case.
 *
 * Errors raised inside the pipeline propagate to the underlying subscription
 * and terminate it (standard RxJS semantics). Handle expected failures with
 * `catchError` inside `generator`.
 *
 * @param store — the store accumulator (the value `withMethods` hands to its
 *   callback, or any store returned by `signalStore(...)`). Must carry the
 *   internal `META` symbol or the call throws.
 * @param generator — receives the central `Subject` as an `Observable` and
 *   returns the configured pipeline. Whatever this Observable emits is
 *   silently consumed; side effects belong in `tap(...)`.
 * @example
 * ```ts
 * import { signalStore, withState, withMethods, rxMethod, patchState } from '@fluch/signal-store';
 * import { debounceTime, switchMap, tap } from 'rxjs/operators';
 * import { from } from 'rxjs';
 *
 * const userStore = signalStore(
 *   withState({ user: null as User | null, loading: false }),
 *   withMethods((store) => ({
 *     loadUser: rxMethod<string>(store, (id$) =>
 *       id$.pipe(
 *         tap(() => patchState(store, { loading: true })),
 *         debounceTime(200),
 *         switchMap((id) => from(api.loadUser(id))),
 *         tap((user) => patchState(store, { user, loading: false })),
 *       ),
 *     ),
 *   })),
 * );
 *
 * userStore.loadUser('id-123');           // scalar — fires once
 * userStore.loadUser(searchIdSignal);     // signal — re-fires on every change
 * userStore.loadUser(idObservable$);      // observable — forwards each emission
 * ```
 */
export function rxMethod<Input>(
  store: object,
  generator: (source$: Observable<Input>) => Observable<unknown>,
): RxMethod<Input> {
  const meta = getMeta(store);
  if (meta === undefined) {
    throw new Error('rxMethod must be called with a signalStore(...) instance');
  }

  const source$ = new Subject<Input>();
  meta.cleanup.add(generator(source$.asObservable()).subscribe());

  return (input) => {
    if (meta.cleanup.closed) return Subscription.EMPTY;

    if (input instanceof Signal) {
      const sub = toObservable(input as Signal<Input>).subscribe((v) => source$.next(v));
      registerOnCleanup(meta, sub);
      return sub;
    }

    if (input instanceof Observable) {
      const sub = input.subscribe((v) => source$.next(v));
      registerOnCleanup(meta, sub);
      return sub;
    }

    source$.next(input as Input);
    return Subscription.EMPTY;
  };
}
