import { type Signal, signal } from '@preact/signals-core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, map, scan } from 'rxjs/operators';
import { devFreeze } from './dev-freeze';

export const META = Symbol('signal-store.meta');

type RawState = Record<string, unknown>;

export type Mutation = Partial<RawState> | ((current: RawState) => Partial<RawState>);

export type StoreMeta = {
  state$: BehaviorSubject<RawState>;
  mutations$: Subject<Mutation>;
  stateSignals: Record<string, Signal<unknown>>;
  cleanup: Subscription;
  destroy(): void;
};

type MetaCarrier = { [META]?: StoreMeta };

function reducer(acc: RawState, mut: Mutation, registered: Record<string, unknown>): RawState {
  const partial = typeof mut === 'function' ? mut(acc) : mut;
  const next: RawState = { ...acc };
  for (const key in partial) {
    if (key in registered) next[key] = devFreeze(partial[key]);
  }
  return next;
}

export function createStoreInternals(): Record<string, unknown> {
  const acc: Record<string, unknown> = {};
  attachMeta(acc);
  return acc;
}

function attachMeta(target: object): StoreMeta {
  const mutations$ = new Subject<Mutation>();
  const state$ = new BehaviorSubject<RawState>({});
  const cleanup = new Subscription();
  const stateSignals: Record<string, Signal<unknown>> = {};

  cleanup.add(
    mutations$
      .pipe(scan((acc, mut) => reducer(acc, mut, stateSignals), {} as RawState))
      .subscribe((next) => state$.next(next)),
  );

  const meta: StoreMeta = {
    state$,
    mutations$,
    stateSignals,
    cleanup,
    destroy() {
      cleanup.unsubscribe();
      mutations$.complete();
      state$.complete();
    },
  };

  Object.defineProperty(target, META, {
    value: meta,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return meta;
}

export function getMeta(target: object): StoreMeta | undefined {
  return (target as MetaCarrier)[META];
}

export function registerState<T>(input: object, key: string, initial: T): Signal<T> {
  const sig = signal(initial);
  const meta = getMeta(input);
  if (meta !== undefined) {
    meta.stateSignals[key] = sig as Signal<unknown>;
    meta.mutations$.next({ [key]: initial });
    meta.cleanup.add(
      meta.state$
        .pipe(
          map((s) => s[key] as T),
          distinctUntilChanged(),
        )
        .subscribe((v) => {
          sig.value = v;
        }),
    );
  }
  return sig;
}
