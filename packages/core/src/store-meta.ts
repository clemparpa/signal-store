import { type Signal, signal } from '@preact/signals-core';
import { Subject } from 'rxjs';
import { scan } from 'rxjs/operators';
import { devFreeze } from './dev-freeze';

export const META = Symbol('signal-store.meta');

type RawState = Record<string, unknown>;

export type Mutation = Partial<RawState> | ((current: RawState) => Partial<RawState>);

export type StoreMeta = {
  rawState: RawState;
  stateSignals: Record<string, Signal<unknown>>;
  mutations$: Subject<Mutation>;
};

type MetaCarrier = { [META]?: StoreMeta };

export function attachMeta(target: object): StoreMeta {
  const meta: StoreMeta = {
    rawState: {},
    stateSignals: {},
    mutations$: new Subject<Mutation>(),
  };

  meta.mutations$
    .pipe(
      scan((acc, mut) => {
        const partial = typeof mut === 'function' ? mut(acc) : mut;
        const next: RawState = { ...acc };
        for (const key in partial) {
          if (key in meta.stateSignals) next[key] = devFreeze(partial[key]);
        }
        return next;
      }, meta.rawState),
    )
    .subscribe((next) => {
      for (const key in next) {
        if (meta.rawState[key] !== next[key]) {
          meta.rawState[key] = next[key];
          const slot = meta.stateSignals[key];
          if (slot !== undefined) slot.value = next[key];
        }
      }
    });

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
    meta.rawState[key] = initial;
  }
  return sig;
}
