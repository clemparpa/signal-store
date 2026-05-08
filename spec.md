# `@flush/signal-store` — Spécification v1

## 1. Contexte & objectif

Lib React de state management inspirée de **NgRx SignalStore** (la feature `@ngrx/signals`, pas le Store classique avec actions/reducers/effects). API déclarative composable, réactivité fine-grained par signal, branchée sur `@preact/signals-react` côté consommateur React.

**Public visé** : devs qui veulent une API structurée et typée à la NgRx, mais en React. Compatibilité naturelle avec RxJS prévue (v2 via `rxMethod`).

**Non-goals v1** : compat avec NgRx classique (Store/Effects/Actions), DevTools, lifecycle hooks, sort comparator d'entities, integration RxJS.

## 2. Décisions de design lockées

| Sujet | Décision | Rationale |
|---|---|---|
| Reactivity primitive | `@preact/signals-core` | Sémantique très proche d'Angular signals |
| Binding React | Opt-in via `@preact/signals-react` (peer dep) côté consommateur | Permet `{store.count.value}` dans le JSX avec re-render fine-grained |
| Syntaxe de lecture | `store.foo.value` (Preact-native) | Pas de Proxy, pas de wrapper callable |
| State shape | **Un signal par clé top-level** de l'état | Réactivité fine-grained gratuite, pas de selector mémoïsé à écrire |
| Instanciation par défaut | Singleton module (option A) | Mappe sur `providedIn: 'root'` de NgRx |
| Instanciation alternative | Provider/Context (option B) dans package séparé | Pour scoping par sous-arbre |
| Entities | Multi-collection dès v1, ID selector custom, **pas de sort** | Sort se fait via `withComputed` |
| Immutabilité | `Object.freeze` en dev sur l'état | Catch les mutations directes |
| Méthodes v1 | Synchrones uniquement | Async/RxJS reportés en v2 (`rxMethod`) |
| Architecture | Monorepo pnpm, packages séparés | Bundle size + extensibilité |

## 3. Architecture monorepo

```
@flush/signal-store/                   ← repo
├── pnpm-workspace.yaml
├── package.json (private, root)
├── tsconfig.base.json
├── biome.json (ou eslint+prettier)
├── .changeset/
└── packages/
    ├── core/                          → @flush/signal-store
    │   peer: @preact/signals-core
    ├── entities/                      → @flush/signal-store-entities
    │   deps: @flush/signal-store
    │   peer: @preact/signals-core
    └── react/                         → @flush/signal-store-react   (option B)
        peer: react, @preact/signals-react, @flush/signal-store
```

Packages prévus pour v2 (à ne PAS implémenter maintenant) :
- `@flush/signal-store-rxjs` — `rxMethod`, interop signal↔observable
- `@flush/signal-store-devtools` — bridge Redux DevTools

**Stack** :
- TypeScript strict
- Build : `tsup` (ESM + CJS + `.d.ts`)
- Test : `vitest`
- Versionning : `changesets`
- Lint/format : `biome` (un seul outil)

## 4. API publique v1

### 4.1. `signalStore(...features)`

Compose des features et retourne un **objet store singleton**. Chaque feature est une fonction qui transforme une description de store accumulée.

```ts
function signalStore<T extends StoreShape>(
  ...features: SignalStoreFeature[]
): T;
```

Le résultat est un objet plat où cohabitent :
- Signaux d'état (writable internes, exposés en lecture)
- Signaux computed (readonly)
- Méthodes (fonctions)

**Collision de noms** : si une feature redéfinit une clé déjà présente (state vs computed vs method), **throw au runtime** avec message clair. (TypeScript devrait déjà le détecter, mais on garde un garde-fou.)

### 4.2. `withState(initial)`

```ts
function withState<S extends Record<string, unknown>>(
  initial: S
): SignalStoreFeature;
```

Crée un signal par clé top-level de `initial`. Les valeurs imbriquées **ne sont pas** transformées en signals (un objet reste un objet, traité atomiquement).

```ts
withState({ count: 0, user: { name: 'foo' } })
// → store.count : Signal<number>
// → store.user  : Signal<{ name: string }>
//   (mutation de user.name NE déclenche PAS de re-render — il faut patchState)
```

En dev (`process.env.NODE_ENV !== 'production'`), les valeurs objets/arrays sont passées à `Object.freeze` (deep) à l'init et après chaque `patchState`.

### 4.3. `withComputed(fn)`

```ts
function withComputed<C extends Record<string, ReadonlySignal<unknown>>>(
  fn: (store: ReadonlyStore) => C
): SignalStoreFeature;
```

`fn` reçoit le store accumulé jusqu'ici (state + computed précédents) et retourne un objet de signals computed.

```ts
withComputed(({ count }) => ({
  double: computed(() => count.value * 2),
}))
```

Le store passé à `fn` n'expose **que** les signaux (state + computed déjà déclarés), **pas** les méthodes (qui ne sont pas encore définies à ce stade de la composition).

### 4.4. `withMethods(fn)`

```ts
function withMethods<M extends Record<string, (...args: any[]) => any>>(
  fn: (store: StoreWithSignals) => M
): SignalStoreFeature;
```

`fn` reçoit le store complet sauf les méthodes (state signals + computed signals) et retourne un objet de méthodes synchrones. Les méthodes peuvent appeler `patchState(store, ...)` pour muter l'état.

```ts
withMethods((store) => ({
  increment: () => patchState(store, { count: store.count.value + 1 }),
  reset: () => patchState(store, { count: 0 }),
}))
```

**v1 = sync only.** Si une méthode retourne une `Promise`, on ne la cancel pas, on ne la track pas — c'est au consommateur de gérer (en attendant `rxMethod` en v2).

### 4.5. `patchState(store, partial | updater)`

```ts
type StateUpdater<S> = (current: S) => Partial<S>;

function patchState<S>(
  store: SignalStore<S>,
  update: Partial<S> | StateUpdater<S> | ((s: S) => Partial<S>)
): void;
function patchState<S>(
  store: SignalStore<S>,
  ...updates: (Partial<S> | StateUpdater<S>)[]
): void;
```

- Accepte un objet partiel ou une fonction `current → partial`
- Accepte plusieurs updates en arguments variadiques (composables, ex: entities)
- Pour chaque clé du partial résultant, set `store[key].value = newValue`
- En dev : freeze profond du nouveau partial avant assignation
- N'écrit que les clés présentes dans le partial (les autres signaux ne sont pas touchés → pas de re-render parasite)

```ts
patchState(store, { count: 5 });
patchState(store, (s) => ({ count: s.count + 1 }));
patchState(store, addEntity(todo), { filter: 'all' });  // multi-update
```

### 4.6. `withEntities` (package `@flush/signal-store-entities`)

#### Cas mono-collection (default)

```ts
function withEntities<E>(config?: {
  selectId?: (entity: E) => string | number;  // default: e => e.id
}): SignalStoreFeature;
```

Ajoute au state :
- `ids: Signal<(string|number)[]>` — ordre d'insertion (sauf override par updater)
- `entityMap: Signal<Record<string|number, E>>` — lookup O(1)

Et au computed :
- `entities: ReadonlySignal<E[]>` — dérivé de `ids` + `entityMap`

#### Cas multi-collection

```ts
function withEntities<E>(config: {
  collection: string;          // ex: 'users'
  selectId?: (entity: E) => string | number;
}): SignalStoreFeature;
```

Préfixe les noms : `usersIds`, `usersEntityMap`, `usersEntities`. Plusieurs `withEntities` dans le même `signalStore` = OK tant que les `collection` diffèrent.

#### Updaters (à passer à `patchState`)

Tous retournent un `StateUpdater` (closure qui prend le state courant et retourne un partial).

```ts
addEntity<E>(entity: E, config?: EntityConfig): StateUpdater
addEntities<E>(entities: E[], config?: EntityConfig): StateUpdater
setEntity<E>(entity: E, config?): StateUpdater       // upsert single
setEntities<E>(entities: E[], config?): StateUpdater
setAllEntities<E>(entities: E[], config?): StateUpdater  // remplace tout
updateEntity<E>(update: { id, changes: Partial<E> | (e: E) => Partial<E> }, config?): StateUpdater
updateEntities<E>(updates: Update<E>[], config?): StateUpdater
updateAllEntities<E>(changes, config?): StateUpdater
removeEntity(id: string|number, config?): StateUpdater
removeEntities(ids: (string|number)[] | predicate, config?): StateUpdater
removeAllEntities(config?): StateUpdater
```

Le `config` permet de cibler une collection nommée :
```ts
patchState(store, addEntity(user, { collection: 'users' }));
```

Si pas de `collection` fournie, opère sur la collection default (sans préfixe). Throw runtime si l'updater cible une collection inexistante.

## 5. Notes d'implémentation

### 5.1. Modèle interne du store

Le store est construit en **trois passes** :

1. **State pass** : exécute toutes les `withState`, fusionne les états initiaux, crée un signal par clé.
2. **Computed pass** : exécute toutes les `withComputed` dans l'ordre, en passant `{ ...stateSignals, ...computedSignalsSoFar }`.
3. **Methods pass** : exécute toutes les `withMethods` dans l'ordre, en passant `{ ...stateSignals, ...computedSignals }`. Les méthodes peuvent référencer d'autres méthodes par closure si elles sont déjà définies, mais pas en cross-référence — pour de la cross-référence il faut wrap dans une lambda qui lit `store.foo` à l'appel.

L'ordre de composition compte : `withMethods` doit pouvoir lire les `withComputed` déclarés avant lui.

```ts
const store = signalStore(
  withState({ a: 1 }),
  withComputed(({ a }) => ({ doubleA: computed(() => a.value * 2) })),
  withMethods((s) => ({
    log: () => console.log(s.a.value, s.doubleA.value),  // OK
  })),
);
```

### 5.2. Type inference

C'est la partie la plus exigeante. L'inférence doit propager à travers la composition de features :

```ts
type SignalStoreFeature<Input = {}, Output = {}> = (input: Input) => Output;

function signalStore<F extends SignalStoreFeature[]>(...features: F): ComposeAll<F>;
```

À l'agent : s'inspirer du code source de `@ngrx/signals` pour les helpers de type (chain de génériques accumulés). Cible : que l'utilisateur puisse écrire le store sans aucune annotation de type, et que l'IDE infère parfaitement les signaux et méthodes accessibles.

### 5.3. `Object.freeze` en dev

```ts
function devFreeze<T>(value: T): T {
  if (process.env.NODE_ENV === 'production') return value;
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value)) devFreeze((value as any)[k]);
  return value;
}
```

À appliquer à chaque valeur mise dans un signal (init + après patch).

### 5.4. Stratégie pour les entities

State interne par collection :
```ts
{ ids: ID[], entityMap: Record<ID, E> }
```

`entities` est un `computed` qui mappe `ids → entityMap[id]`. **Important** : la dépendance computed se déclenche quand `ids` OU `entityMap` change, donc tout patch d'entity → re-render des consommateurs de `entities`. Pour réactivité plus fine, le consommateur peut faire son propre `computed` filtré.

Updater `addEntity(e)` retourne :
```ts
(state) => ({
  ids: [...state.ids, selectId(e)],
  entityMap: { ...state.entityMap, [selectId(e)]: e },
})
```

Pour multi-collection avec préfixe `users` :
```ts
(state) => ({
  usersIds: [...state.usersIds, selectId(e)],
  usersEntityMap: { ...state.usersEntityMap, [selectId(e)]: e },
})
```

L'updater connaît la `collection` via le `config` argument. Le config par défaut est lu d'un registre interne au store (chaque `withEntities` enregistre sa collection + son `selectId`).

**Détail crucial** : `selectId` doit être disponible à l'updater au moment de l'exécution. Solutions :
- (a) Le store stocke un registre `__entityConfigs__: { [collection]: { selectId } }` lu par les updaters
- (b) Les updaters reçoivent le store en paramètre (cassent la composition fluide avec `patchState`)

→ Aller sur **(a)**. Le registre est attaché au store comme symbole non-énumérable.

## 6. Exemple complet attendu

```ts
import { signalStore, withState, withComputed, withMethods, patchState } from '@flush/signal-store';
import { withEntities, addEntity, updateEntity, removeEntity, setAllEntities } from '@flush/signal-store-entities';
import { computed } from '@preact/signals-core';

type Todo = { id: string; title: string; done: boolean };
type User = { uuid: string; name: string };

export const appStore = signalStore(
  withState({ filter: '' as 'all' | 'pending' | 'done' | '' }),
  withEntities<Todo>(),
  withEntities<User>({ collection: 'users', selectId: (u) => u.uuid }),

  withComputed(({ entities, filter }) => ({
    visible: computed(() => {
      const f = filter.value;
      const all = entities.value;
      if (f === 'pending') return all.filter(t => !t.done);
      if (f === 'done') return all.filter(t => t.done);
      return all;
    }),
  })),

  withMethods((store) => ({
    setFilter: (f: typeof store.filter.value) => patchState(store, { filter: f }),
    addTodo:   (t: Todo) => patchState(store, addEntity(t)),
    toggle:    (id: string) => patchState(store, updateEntity({
      id,
      changes: (t) => ({ done: !t.done }),
    })),
    remove:    (id: string) => patchState(store, removeEntity(id)),
    loadAll:   (todos: Todo[]) => patchState(store, setAllEntities(todos)),
    addUser:   (u: User) => patchState(store, addEntity(u, { collection: 'users' })),
  })),
);
```

Usage React (avec `@preact/signals-react` installé dans l'app) :

```tsx
import { appStore } from './store';

export function TodoApp() {
  return (
    <>
      <input
        value={appStore.filter}
        onChange={(e) => appStore.setFilter(e.target.value as any)}
      />
      <ul>
        {appStore.visible.value.map(t => (
          <li key={t.id} onClick={() => appStore.toggle(t.id)}>
            {t.title} {t.done && '✓'}
          </li>
        ))}
      </ul>
      <p>{appStore.usersEntities.value.length} users loaded</p>
    </>
  );
}
```

## 7. Tests à prévoir

Couverture cible : >90% sur core et entities. Vitest, pas de mocks de signals (utiliser les vrais).

### Core
- `withState` crée un signal par clé top-level
- `patchState` ne touche que les clés présentes dans le partial
- `patchState` accepte updater function, plusieurs partials variadiques
- `patchState` freeze en dev, ne freeze pas en prod
- `withComputed` reçoit les state signals + computed précédents
- `withMethods` peut lire state + computed
- Collision de noms (state/computed/method) → throw
- Ordre de composition : computed lit l'état précédent, method lit computed précédent

### Entities
- Mono-collection : add/update/remove/setAll
- ID selector custom (`uuid` au lieu de `id`)
- Multi-collection : pas de collision entre collections
- `addEntity` sur ID existant → no-op (vs `setEntity` qui upsert)
- `updateEntity` avec changes-as-function
- `removeEntities` avec predicate
- `entities` computed se met à jour après chaque mutation

## 8. Hors scope v1 — design préliminaire pour v2

À documenter mais NE PAS implémenter :

- **`rxMethod`** : prend un input (`Signal<T> | Observable<T> | T`), un pipeline RxJS, exécute. Source : `@ngrx/signals/rxjs-interop`. Helpers `toObservable(signal)` et `toSignal(observable)` à porter (~20 lignes chacun avec Preact signals).
- **`withHooks({ onInit, onDestroy })`** : `onInit` au premier accès au store (singleton) ou au mount du Provider (mode B). `onDestroy` uniquement en mode B (unmount Provider).
- **DevTools** : intercepter chaque `patchState`, push dans Redux DevTools extension avec un nom d'action dérivé de la stack (`addTodo`, `setFilter`).
- **Sort comparator entities** : option `sortComparer` dans `withEntities`. Auto-tri à chaque insert/update.

## 9. Checklist de livraison v1

- [ ] Repo monorepo pnpm initialisé, workspaces configurés
- [ ] `@flush/signal-store` (core) : signalStore, withState, withComputed, withMethods, patchState
- [ ] `@flush/signal-store-entities` : withEntities (mono + multi), tous les updaters listés en 4.6
- [ ] `@flush/signal-store-react` : Provider + useStore (mode B)
- [ ] Types parfaitement inférés sans annotation manuelle
- [ ] Tests vitest >90% coverage sur core + entities
- [ ] Build tsup ESM+CJS+dts, treeshakeable
- [ ] README dans chaque package avec exemple minimal
- [ ] `.changeset/` configuré pour publication
- [ ] CI GitHub Actions : lint + typecheck + test + build
- [ ] Bundle size cible : core <3kb gzip, entities <2kb gzip
