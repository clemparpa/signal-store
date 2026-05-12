import { type Signal, signal } from '@preact/signals-core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, map, scan } from 'rxjs/operators';
import { devFreeze } from './dev-freeze';
import type { StateSignals } from './types';

export const META = Symbol('signal-store.meta');

type RawState = Record<string, unknown>;

export type Mutation = Partial<RawState> | ((current: RawState) => Partial<RawState>);

export type StoreMeta = {
  state$: BehaviorSubject<RawState>;
  mutations$: Subject<Mutation>;
  stateSignals: Record<string, Signal<unknown>>;
  cleanup: Subscription;
  declareState<S extends RawState>(initial: S): StateSignals<S>;
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
    declareState<S extends RawState>(initial: S): StateSignals<S> {
      const out = {} as { [K in keyof S]: Signal<S[K]> };
      for (const key in initial) {
        const sig = signal(devFreeze(initial[key]));
        stateSignals[key] = sig as Signal<unknown>;
        mutations$.next({ [key]: initial[key] });
        cleanup.add(
          state$
            .pipe(
              map((s) => s[key] as S[typeof key]),
              distinctUntilChanged(),
            )
            .subscribe((v) => {
              sig.value = v;
            }),
        );
        out[key] = sig;
      }
      return out as StateSignals<S>;
    },
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
