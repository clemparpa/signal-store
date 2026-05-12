import { type SignalStoreFeature, withState } from '@fluch/signal-store';
import { computed, type ReadonlySignal } from '@preact/signals-core';
import { entitiesKey, idsKey, mapKey } from './internal/keys';
import type { EntitiesKey, EntityConfig, EntityId, IdsKey, MapKey } from './types';

export type EntityFeatureOutput<E, C extends string> = {
  [K in IdsKey<C>]: ReadonlySignal<EntityId[]>;
} & {
  [K in MapKey<C>]: ReadonlySignal<Record<EntityId, E>>;
} & {
  [K in EntitiesKey<C>]: ReadonlySignal<E[]>;
};

// biome-ignore lint/complexity/noBannedTypes: identity element for feature composition (matches core's EmptySlot)
type EmptySlot = {};

export function withEntities<E, C extends string = ''>(
  config: EntityConfig<E, C>,
): SignalStoreFeature<EmptySlot, EntityFeatureOutput<E, C>> {
  const kIds = idsKey(config.collection);
  const kMap = mapKey(config.collection);
  const kEnts = entitiesKey(config.collection);

  return (input) => {
    const stateSignals = withState({
      [kIds]: [] as EntityId[],
      [kMap]: {} as Record<EntityId, E>,
    })(input) as Record<string, ReadonlySignal<unknown>>;

    const idsSig = stateSignals[kIds] as ReadonlySignal<EntityId[]>;
    const mapSig = stateSignals[kMap] as ReadonlySignal<Record<EntityId, E>>;
    const entitiesSig: ReadonlySignal<E[]> = computed(() =>
      idsSig.value.map((id) => mapSig.value[id] as E),
    );

    return { ...stateSignals, [kEnts]: entitiesSig } as unknown as EntityFeatureOutput<E, C>;
  };
}
