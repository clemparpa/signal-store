# `@fluch/signal-store` — Spécification v1

## 1. Contexte & objectif

Lib React de state management inspirée de **NgRx SignalStore** (la feature `@ngrx/signals`, pas le Store classique avec actions/reducers/effects). API déclarative composable, réactivité fine-grained par signal, branchée sur `@preact/signals-react` côté consommateur React.

**Public visé** : devs qui veulent une API structurée et typée à la NgRx, mais en React. Moteur interne basé sur **rxjs** (pipeline `mutations$` → reducer → `state$` → facade signaux, cf. §5.5) ; interop publique RxJS via `rxMethod` reportée en v2.

**Non-goals v1** : compat avec NgRx classique (Store/Effects/Actions), DevTools, lifecycle hooks (`withHooks`), `rxMethod` (pipeline RxJS public), sort comparator d'entities.

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
| Méthodes v1 | Synchrone recommandé ; les méthodes async marchent mais non gérées | Le store ne tracke pas la `Promise`, ne cancel rien — `rxMethod` v2 pour pipelines gérés |
| Architecture interne | Source brute via rxjs `BehaviorSubject` + facade signaux (cf. §5.5) | Permet devtools/persistence/time-travel/hooks v2 sans casser l'API publique |
| Architecture monorepo | Monorepo pnpm, packages séparés | Bundle size + extensibilité |

## 3. Architecture monorepo

```
@fluch/signal-store/                   ← repo
├── pnpm-workspace.yaml
├── package.json (private, root)
├── tsconfig.base.json
├── biome.json (ou eslint+prettier)
├── .changeset/
├── apps/
│   └── docs/                          → site Starlight (privé, non publié)
└── packages/
    ├── core/                          → @fluch/signal-store
    │   peer: @preact/signals-core, rxjs
    ├── entities/                      → @fluch/signal-store-entities
    │   deps: @fluch/signal-store
    │   peer: @preact/signals-core
    └── react/                         → @fluch/signal-store-react   (option B)
        peer: react, @preact/signals-react, @fluch/signal-store
```

Packages prévus pour v2 (à ne PAS implémenter maintenant) :
- `@fluch/signal-store-rxjs` — `rxMethod`, interop signal↔observable
- `@fluch/signal-store-devtools` — bridge Redux DevTools

**Stack** :
- TypeScript strict
- Build : `tsup` (ESM + CJS + `.d.ts`)
- Test : `vitest`
- Versionning : `changesets`
- Lint/format : `biome` (un seul outil)

## 4. API publique v1

### 4.1. `signalStore(...features)`

Compose des features et retourne un **objet store**. Chaque feature reçoit l'accumulateur (les clés déjà déclarées) et retourne les clés qu'elle ajoute. La signature publique est typée via **10 overloads positionnels** qui accumulent les outputs en intersection — cf. [packages/core/src/signal-store.ts](packages/core/src/signal-store.ts) et §5.2 :

```ts
function signalStore(): {};
function signalStore<Out1 extends object>(
  f1: SignalStoreFeature<{}, Out1>,
): Out1;
function signalStore<Out1 extends object, Out2 extends object>(
  f1: SignalStoreFeature<{}, Out1>,
  f2: SignalStoreFeature<{} & Out1, Out2>,
): Out1 & Out2;
// ... jusqu'à 10 features.
```

**Plafond : 10 features par appel** avec inférence parfaite (la 11e fait perdre les types accumulés). Au-delà : factoriser en sub-features composées qui retournent elles-mêmes un `SignalStoreFeature`.

Le résultat est un objet plat où cohabitent :

- Signaux d'état (writable en interne via le pipeline rxjs §5.5, exposés en lecture seule au consommateur)
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

**v1 — synchrone recommandé.** Les méthodes async (qui retournent une `Promise`) marchent fonctionnellement, mais le store ne tracke pas la `Promise`, ne cancel rien à l'unmount, et n'expose pas de loading state. C'est au consommateur de gérer — ou d'attendre `rxMethod` en v2 (pipelines RxJS managés avec cancel, lifecycle, et interop signal↔observable, cf. §10).

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
- Accepte plusieurs updates en arguments variadiques (composables, ex: entities) — chaque update est poussé séquentiellement dans `mutations$`
- Chaque update est pushé dans `mutations$`, un reducer rxjs (`scan`) l'applique sur le state brut (`state$: BehaviorSubject<RawState>`), puis les signaux facade se synchronisent via `distinctUntilChanged` (cf. §5.5)
- En dev : freeze profond du nouveau partial avant assignation au state brut
- N'écrit que les clés présentes dans le partial **et** déclarées via `withState`/`withEntities` (les autres signaux ne sont pas touchés → pas de re-render parasite ; les clés inconnues sont ignorées silencieusement par le reducer)
- **Après `destroyStore`** : les appels suivants sont silencieusement ignorés (pas de throw ; le `Subject mutations$` est complété, plus rien ne se propage)

```ts
patchState(store, { count: 5 });
patchState(store, (s) => ({ count: s.count + 1 }));
patchState(store, addEntity(todo), { filter: 'all' });  // multi-update
```

### 4.6. `withEntities` (package `@fluch/signal-store-entities`)

L'API entities repose sur un **builder typé** `entityConfig()` capturé en closure par le consommateur, puis passé explicitement à la feature et à chaque updater. Pas de registre interne au store : la config voyage par argument, et le préfixe `collection` (string literal) sert à dériver les clés au type-level.

#### `entityConfig<E, C extends string = ''>(opts?)`

```ts
function entityConfig<E, C extends string = ''>(opts?: {
  collection?: C;                                 // default: ''
  selectId?: (entity: E) => string | number;      // default: e => e.id
}): EntityConfig<E, C>;
```

À capturer dans une `const` top-level — c'est cette closure que les updaters et `withEntities` reçoivent.

#### `withEntities(cfg)`

```ts
function withEntities<E, C extends string>(
  cfg: EntityConfig<E, C>,
): SignalStoreFeature<{}, EntityFeatureOutput<E, C>>;
```

Ajoute au store, **clés dérivées du préfixe `C`** :

- `<C>Ids: ReadonlySignal<EntityId[]>` (ou `ids` si `C = ''`) — ordre d'insertion
- `<C>EntityMap: ReadonlySignal<Record<EntityId, E>>` (ou `entityMap`) — lookup O(1)
- `<C>Entities: ReadonlySignal<E[]>` (ou `entities`) — computed `ids.map(id => map[id])`

Plusieurs `withEntities` dans le même `signalStore` = OK tant que les `collection` diffèrent (collision détectée par le check de §4.1).

#### Updaters (à passer à `patchState`)

Chaque updater retourne un `CollectionUpdater<E, C>` — closure `(state) => Partial<CollectionSlice<E, C>>`. Le `cfg` est **toujours requis** (pas optionnel) :

```ts
addEntity<E, C>(entity: E, cfg: EntityConfig<E, C>): CollectionUpdater<E, C>
addEntities<E, C>(entities: readonly E[], cfg): CollectionUpdater<E, C>
setEntity<E, C>(entity: E, cfg): CollectionUpdater<E, C>           // upsert single
setEntities<E, C>(entities: readonly E[], cfg): CollectionUpdater<E, C>
setAllEntities<E, C>(entities: readonly E[], cfg): CollectionUpdater<E, C>  // remplace tout
updateEntity<E, C>(update: { id, changes: Partial<E> | (e: E) => Partial<E> }, cfg): CollectionUpdater<E, C>
updateEntities<E, C>(updates: ReadonlyArray<{ id, changes }>, cfg): CollectionUpdater<E, C>
updateAllEntities<E, C>(changes, cfg): CollectionUpdater<E, C>
removeEntity<E, C>(id: EntityId, cfg): CollectionUpdater<E, C>
removeEntities<E, C>(ids: readonly EntityId[], cfg): CollectionUpdater<E, C>
removeAllEntities<E, C>(cfg): CollectionUpdater<E, C>
```

Exemple d'utilisation :

```ts
const todosCfg = entityConfig<Todo>({ collection: 'todos' });
const usersCfg = entityConfig<User>({ collection: 'users', selectId: (u) => u.uuid });

const store = signalStore(
  withEntities(todosCfg),
  withEntities(usersCfg),
);

patchState(store, addEntity(todo, todosCfg));
patchState(store, addEntity(user, usersCfg));
```

**No-op semantics** : `addEntity` sur id existant, `removeEntity` sur id inconnu, `updateEntity` sur id inconnu → retournent `{}` (mutation ignorée par le reducer). `setEntity` upsert (overwrite si existe, append sinon).

### 4.7. `destroyStore(store)`

```ts
function destroyStore(store: object): void;
```

Tear down le pipeline rxjs interne (cf. §5.5) : `cleanup.unsubscribe()` sur l'agrégateur de subscriptions, puis `complete()` sur `mutations$` et `state$`.

- **Idempotent** : safe à appeler plusieurs fois (no-op après le premier appel).
- **Sémantique post-destroy** : les signaux gardent leur dernière valeur lue, `patchState` est silencieusement no-op (pas de throw).
- **Option B (Provider React)** : le `<Provider>` de `@fluch/signal-store-react` appelle `destroyStore` automatiquement à l'unmount — le consommateur ne l'appelle jamais.
- **Option A (singleton module)** : à la discrétion du consommateur. En pratique, le store vit aussi longtemps que l'app et `destroyStore` n'est jamais appelé hors tests d'isolation.

### 4.8. `withHooks({ onInit, onDestroy })`

```ts
interface HooksConfig<In extends object> {
  onInit?: (store: In) => void;
  onDestroy?: (store: In) => void;
}

function withHooks<In extends object>(hooks: HooksConfig<In>): SignalStoreFeature<In, {}>;
```

Enregistre des callbacks de cycle de vie sur le store. Les deux callbacks sont optionnels indépendamment ; `withHooks({})` est un no-op valide.

- **`onInit`** s'exécute synchrone **à la fin** de `signalStore(...)`, après que toutes les features (même celles placées après `withHooks` dans la composition) soient assemblées. Le `store` passé est l'objet final : signaux, computed et méthodes sont tous accessibles. `onInit` peut pousser des mutations initiales via `patchState`.
- **`onDestroy`** s'exécute à l'invocation de `destroyStore` (donc automatiquement à l'unmount du `<Provider>` React). Idempotent — un seul appel même si `destroyStore` est rappelé (garde via `cleanup.closed`). Le store est encore **live** quand `onDestroy` fire : les signaux sont lisibles, `patchState` propage normalement, on peut faire un dernier cleanup managé. Le tear-down du pipeline rxjs (cf. §5.5) intervient juste après. La sémantique "silent no-op de patchState après destroy" s'applique au code **externe** appelé une fois `destroyStore` retourné.

Plusieurs `withHooks(...)` dans le même `signalStore(...)` sont autorisés : les `onInit` s'exécutent dans l'ordre de composition (`[1, 2, 3]`), les `onDestroy` en **ordre inverse** (LIFO, `[3, 2, 1]`) — sémantique habituelle d'un stack de teardowns. Aligné NgRx SignalStore.

**Synchrones uniquement**. Le type est `(store) => void` strict — TypeScript refuse `onInit: async () => {...}`. Aligné NgRx (cf. leur `HookFn`). Pour du fire-and-forget intentionnel, wrapper en IIFE explicite :

```ts
withHooks({
  onInit(s) {
    void (async () => {
      const data = await fetchInitialData();
      patchState(s, { data });
    })();
  },
})
```

Pour des pipelines async **gérés** (cancellable, debounced, etc.), c'est `rxMethod` (v2) qui couvrira — l'IIFE reste un fallback pour les cas simples.

Si `onInit` throw, l'erreur remonte et `signalStore(...)` ne retourne pas. Attraper l'erreur côté caller et invoquer `destroyStore` sur le store partiel si nécessaire pour libérer les ressources.

**Typage** : `In` est inféré par la position dans la composition — `onInit`/`onDestroy` reçoivent au type-level uniquement les features qui précèdent `withHooks`. Au runtime le store est complet. Placer `withHooks` en dernier pour avoir visibilité maximale au type-level.

```ts
const store = signalStore(
  withState({ count: 0 }),
  withMethods((s) => ({
    increment: () => patchState(s, { count: s.count.value + 1 }),
  })),
  withHooks({
    onInit(s) { patchState(s, { count: 1 }); },
    onDestroy(s) { console.log('final:', s.count.value); },
  }),
);
```

### 4.9. `rxMethod(store, generator)`

```ts
type RxMethod<Input> = (
  input: Input | Signal<Input> | ReadonlySignal<Input> | Observable<Input>,
) => Subscription;

function rxMethod<Input>(
  store: object,
  generator: (source$: Observable<Input>) => Observable<unknown>,
): RxMethod<Input>;
```

Crée une méthode managée alimentée par un pipeline RxJS. Le `store` (l'accumulateur passé à `withMethods`, ou toute valeur retournée par `signalStore(...)`) est explicite — il porte le `META` interne qui permet à `rxMethod` de s'enregistrer sur `meta.cleanup` (cf. §5.5). Aligne la convention `patchState(store, ...)` / `destroyStore(store)` : pas de DI implicite, pas de magic.

- **Sémantique pipeline** : un unique `Subject<Input>` est créé en interne, le `generator` y branche son pipeline, et la subscription résultante est ajoutée à `meta.cleanup`. **Toutes** les invocations passent par ce même Subject — les opérateurs stateful (`debounceTime`, `switchMap`, `concatMap`, etc.) se comportent correctement entre appels.
- **Trois shapes d'input** acceptées :
  - **Scalaire `Input`** : pushé une fois via `source$.next(input)`. Retourne `Subscription.EMPTY`.
  - **Signal `Signal<Input> | ReadonlySignal<Input>`** : la valeur courante est pushée immédiatement (sémantique `signal.subscribe` Preact), puis chaque change. Retourne la Subscription du binding signal → l'appelant peut `unsubscribe()` pour couper le pont avant `destroyStore`.
  - **Observable `Observable<Input>`** : chaque émission est forwardée. Retourne la Subscription source. La complétion de la source ne complète **pas** le pipeline (resté ouvert pour de futurs inputs).
- **Auto-cleanup** : la subscription du pipeline + chaque binding signal/observable sont ajoutés à `meta.cleanup`. `destroyStore(store)` (ou le Provider React à l'unmount) teardown tout.
- **Post-destroy** : appel silencieux (no-op), retourne `Subscription.EMPTY`. Aligne `patchState` (§4.5).
- **Erreurs pipeline** : standards RxJS — un throw dans `tap`/`map` propage à la subscription et la termine. Wrap avec `catchError` à l'intérieur du `generator` pour récupérer.

```ts
const userStore = signalStore(
  withState({ user: null as User | null, loading: false }),
  withMethods((store) => ({
    loadUser: rxMethod<string>(store, (id$) =>
      id$.pipe(
        tap(() => patchState(store, { loading: true })),
        debounceTime(200),
        switchMap((id) => from(api.loadUser(id))),
        tap((user) => patchState(store, { user, loading: false })),
      ),
    ),
  })),
);

userStore.loadUser('id-123');           // scalar — fires once
userStore.loadUser(searchIdSignal);     // signal — re-fires on every change
userStore.loadUser(idObservable$);      // observable — forwards each emission
```

**Pourquoi pas une feature `withRxMethod(...)`** : 1 feature par méthode serait verbeux (et limité à 10 features par `signalStore`). Le pattern NgRx `rxMethod` à l'intérieur de `withMethods((store) => ({...}))` est plus naturel — `withMethods` reçoit déjà le store accumulé, et `rxMethod(store, ...)` s'y greffe sans nouveau slot dans la composition. C'est aussi pourquoi `rxMethod` n'est **pas** un `SignalStoreFeature` mais un helper retournant une fonction.

**Throw** si appelé avec un objet qui ne porte pas le `META` symbol (i.e. pas un store) : *"rxMethod must be called with a signalStore(...) instance"*.

### 4.10. `toObservable(signal)`

```ts
function toObservable<T>(sig: Signal<T> | ReadonlySignal<T>): Observable<T>;
```

Wrappe un signal Preact en `Observable<T>` cold. Sur subscribe, émet immédiatement la valeur courante (Preact `signal.subscribe` fire synchrone avec la valeur initiale), puis chaque change. L'unsubscribe libère la subscription signal sous-jacente.

Utilisé en interne par `rxMethod` quand l'input est un signal. Exposé publiquement parce qu'utile pour composer des signals dans des pipelines plus larges sans passer par `rxMethod` (ex: `combineLatest(toObservable(a), toObservable(b))`).

```ts
const count = signal(0);
const sub = toObservable(count).subscribe((v) => console.log(v));
// → 0 (synchrone à subscribe)
count.value = 1; // → 1
sub.unsubscribe();
```

`toSignal(observable, initial)` (inverse) **n'est pas exposé en v2**. Le cleanup d'un Observable infini exigerait soit `toSignal(store, obs$, initial)` (verbeux pour un cas marginal), soit un nouveau pattern de registration — différé tant qu'il n'y a pas de cas d'usage exprimé.

### 4.11. `connectDevtools(store, options?)` (package `@fluch/signal-store-devtools`)

```ts
type ConnectDevtoolsOptions = {
  name?: string;        // défaut: 'signal-store'
  instanceId?: string;  // défaut: auto-généré par l'extension
  maxAge?: number;      // défaut: 50
  trace?: boolean;      // défaut: true — dériver le nom d'action depuis la stack
};

type DevtoolsConnection = { disconnect(): void };

function connectDevtools(store: object, options?: ConnectDevtoolsOptions): DevtoolsConnection;
```

Branche un store sur l'extension navigateur [Redux DevTools](https://github.com/reduxjs/redux-devtools/tree/main/extension). Chaque mutation publiée sur `meta.mutations$` (cf. §5.5) déclenche un `conn.send({ type: <derived> }, meta.state$.value)` — l'extension affiche timeline, action log, state tree et diff. Le snapshot initial est envoyé via `conn.init(meta.state$.value)`.

- **Monitor-only** : pas de time travel (`JUMP_TO_STATE`, `JUMP_TO_ACTION`), pas de dispatcher (actions UI → store), pas de skip/reorder. Reportés v2.x+ — exigent une registry d'actions + un historique des deltas. Les features de l'extension sont toutes désactivées via `features: { jump: false, dispatch: false, ... }`.
- **Action naming** : par défaut, `new Error().stack` est capturée à chaque mutation et un parser identifie le premier frame non-interne (skip de `derive-action-name`, `connect-devtools`, `patchState`, RxJS, `node_modules`). Supporte V8 (`at fn (file:line:col)`) et SpiderMonkey/JSCore (`fn@file:line:col`). Fallback `STATE_UPDATE` quand la stack est inutilisable. `trace: false` désactive le parsing → toutes les actions sont `STATE_UPDATE` (utile en build minifié où les noms sont mangled).
- **Post-destroy** : auto-detach via `meta.cleanup.add(mutSub)`. `destroyStore(store)` teardown le relai automatiquement, et `patchState` post-destroy étant lui-même no-op, aucune action ne fuite après destruction.
- **Pas d'extension installée** : silent no-op (pas de `console.warn`) — un `{ disconnect: () => {} }` est retourné. L'appel `if (DEV) connectDevtools(store)` ne casse rien en CI/headless.
- **Tree-shaking prod** : le package est `sideEffects: false`. L'usage canonique est de wrapper l'appel dans un guard `if (import.meta.env.DEV) connectDevtools(store)` — le bundler élimine l'import en production.
- **Multi-store** : chaque appel produit une connexion distincte. Passer un `name` (ou `instanceId`) différent par store pour distinguer dans le picker de l'extension.
- **`disconnect()` manuel** : permet de couper le relai sans détruire le store (HMR par ex). Idempotent.

```ts
import { signalStore, withState, withMethods, patchState } from '@fluch/signal-store';
import { connectDevtools } from '@fluch/signal-store-devtools';

const counter = signalStore(
  withState({ count: 0 }),
  withMethods((s) => ({ increment: () => patchState(s, { count: s.count.value + 1 }) })),
);

if (import.meta.env.DEV) connectDevtools(counter, { name: 'Counter' });

counter.increment(); // DevTools: action "increment", state { count: 1 }
```

**Pourquoi pas une feature `withDevtools()`** : la feature s'évalue à la composition du store et ferait référence à `window.__REDUX_DEVTOOLS_EXTENSION__` y compris dans les chemins de code prod. Un `connectDevtools(store)` impératif wrappable dans un guard `if (DEV) {...}` permet au bundler d'éliminer entièrement l'import en build prod — gain net sur la bundle size de l'app utilisatrice.

**Pourquoi `@fluch/signal-store/internal` ?** Le bridge a besoin d'accéder à `getMeta` pour s'abonner à `mutations$` / `state$`. Plutôt que d'élargir la surface publique du core (qui exposerait `getMeta` à n'importe quel consommateur), on ajoute un subpath dédié au tooling : `import { getMeta } from '@fluch/signal-store/internal'`. Convention reconnue (Vue, Vite). Le contenu de ce subpath n'est **pas** régi par les contraintes semver de l'API publique.

**Throw** si appelé avec un objet sans `META` : *"connectDevtools requires a store built via signalStore(...)"*.

## 5. Notes d'implémentation

### 5.1. Modèle interne du store

Le store est construit en **une seule passe**. `signalStore(...features)` crée un accumulateur (objet `{}` portant un `META` symbole non-énumérable, cf. §5.5), puis exécute chaque feature séquentiellement en fusionnant son output dans l'accumulateur. Collision de clés (même nom déclaré deux fois, state vs computed vs method) → throw au runtime.

```ts
function signalStore(...features: SignalStoreFeature[]): unknown {
  const acc = createStoreInternals();   // {} + META symbole
  for (const feature of features) {
    const out = feature(acc);
    for (const key in out) {
      if (key in acc) throw new Error(`duplicate key "${key}"`);
      acc[key] = out[key];
    }
  }
  return acc;
}
```

Les features sont juste des fonctions `(input) => output`. Pas de distinction state/computed/methods en interne au moment de la composition — la "passe d'état" est entièrement encapsulée dans `withState` (qui appelle `meta.declareState`), et `withComputed`/`withMethods` sont de simples relais qui lisent l'accumulateur.

L'ordre de composition compte : `withMethods` doit pouvoir lire les `withComputed` déclarés avant lui — l'accumulateur partagé garantit que c'est le cas.

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
```

**Choix d'implémentation : 10 overloads positionnels** plutôt qu'un helper `ComposeAll<F>` variadique. Cf. [packages/core/src/signal-store.ts](packages/core/src/signal-store.ts) — chaque overload accumule les outputs en intersection (`Out1 & Out2 & ... & OutN`) et passe `EmptySlot & Out1 & ... & OutN-1` en input de la `N`-ème feature. Bénéfices vs `ComposeAll<F>` :

- Pas de récursion de types coûteuse au check time (TypeScript ne fait pas exploser le compilateur).
- Erreurs de typage localisées sur la feature fautive (vs un message générique sur `ComposeAll`).
- Inférence parfaite garantie sur les 10 premières features.

**Plafond : 10 features par appel.** Au-delà, factoriser en sub-features (`composeFeatures(a, b, c)` qui retourne un `SignalStoreFeature` unique). Acceptable parce que les stores réels font rarement > 5–6 features ; et la limite est explicite, pas un "ça plante mystérieusement".

Cible atteinte : l'utilisateur écrit le store sans aucune annotation, l'IDE infère parfaitement les signaux et méthodes accessibles.

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

### 5.4. Stratégie pour les entities (closure pattern)

State interne par collection :

```ts
{ [`${C}Ids`]: EntityId[], [`${C}EntityMap`]: Record<EntityId, E> }
```

(Pour mono-collection avec `C = ''` : juste `ids` et `entityMap`. Les noms sont dérivés au type-level via `IdsKey<C>` / `MapKey<C>` / `EntitiesKey<C>` — cf. [packages/entities/src/types.ts](packages/entities/src/types.ts).)

`<C>Entities` est un `computed` qui mappe `<C>Ids → <C>EntityMap[id]`. **Important** : la dépendance computed se déclenche quand `<C>Ids` OU `<C>EntityMap` change, donc tout patch d'entity → re-render des consommateurs de `<C>Entities`. Pour une réactivité plus fine, le consommateur peut faire son propre `computed` filtré.

**Comment l'updater connaît `selectId` et le préfixe `collection`** : par **closure**, pas par registre interne. Le consommateur capture le cfg dans une const top-level, et le passe explicitement à `withEntities` et à chaque updater :

```ts
const todosCfg = entityConfig<Todo>({ collection: 'todos' });

withEntities(todosCfg);                              // déclare todosIds/todosEntityMap/todosEntities
patchState(store, addEntity(todo, todosCfg));        // updater capture todosCfg.collection + selectId
```

L'updater `addEntity(e, cfg)` retourne :

```ts
(state) => {
  const kIds = idsKey(cfg.collection);   // 'todosIds' ou 'ids'
  const kMap = mapKey(cfg.collection);   // 'todosEntityMap' ou 'entityMap'
  const id = cfg.selectId(e);
  if (id in state[kMap]) return {};      // no-op si déjà présent
  return {
    [kIds]: [...state[kIds], id],
    [kMap]: { ...state[kMap], [id]: e },
  };
};
```

**Rationale du choix closure plutôt que registre interne** :

- **Meilleur typage** : le `collection` literal `C extends string` permet de dériver `<C>Ids/<C>EntityMap/<C>Entities` au type-level. Un registre runtime aurait demandé des assertions de type ou un `as const` côté consommateur.
- **Simplicité** : pas de magic registry attaché au store, pas de symbole non-énumérable, pas de lookup runtime. L'updater est une fonction pure paramétrée.
- **Explicit > implicit** : le consommateur voit exactement quelle config est utilisée à chaque appel. Renommer la const `todosCfg` → grep-friendly.

**Coût accepté** : le consommateur doit créer une const par collection et la passer partout. Verbosité acceptable pour des collections nommées (cas par défaut = mono-collection ; le cfg peut être créé inline `entityConfig()` si besoin).

### 5.5. Pipeline rxjs interne (signal-facade over raw source)

Décrit l'architecture interne du moteur de store. **L'API publique n'expose rien de rxjs** — c'est un détail d'implémentation, mais il est verrouillé parce qu'il conditionne tous les chantiers v2 (devtools, hooks, persistence, time-travel, `rxMethod`).

**Source de vérité** : un `BehaviorSubject<RawState>` détient le state brut (objet JS plain, JSON-sérialisable). Les signaux exposés à l'utilisateur sont une **facade en lecture** synchronisée par subscription.

**Composants** (cf. [packages/core/src/store-meta.ts](packages/core/src/store-meta.ts)) :

- `META: symbol` — propriété **non-énumérable** attachée à l'objet store ; transporte le `StoreMeta` (channels + cleanup).
- `mutations$: Subject<Partial<RawState> | (s: RawState) => Partial<RawState>>` — channel d'entrée : `patchState` push ici.
- `state$: BehaviorSubject<RawState>` — source brute, mise à jour par le reducer.
- **Reducer** (`scan` operator) : pour chaque `mutation` poussée dans `mutations$`, applique le partial sur l'état courant **en ne retenant que les clés enregistrées** via `declareState` (les clés inconnues sont silencieusement ignorées). En dev, freeze profond du partial avant assignation.
- **Facade signaux** : pour chaque clé déclarée via `withState`/`withEntities`, on crée un `Signal<T>` et on souscrit `state$.pipe(map(s => s[k]), distinctUntilChanged()).subscribe(v => signal.value = v)`. C'est cette subscription qui est l'unique writer du signal → les signaux sont readonly de l'extérieur sans avoir besoin du type `ReadonlySignal`.
- `cleanup: Subscription` — agrège toutes les subscriptions (reducer + facade). `destroyStore` appelle `cleanup.unsubscribe() + mutations$.complete() + state$.complete()`.

**Flux d'un `patchState`** :

```text
patchState(store, { count: 5 })
  → mutations$.next({ count: 5 })
  → scan reducer : nextState = { ...state, count: devFreeze(5) }
  → state$.next(nextState)
  → facade subscriptions : signal.value = 5 (si distinctUntilChanged passe)
  → @preact/signals-core notifie les effects/computed → React re-rend
```

**Bénéfices pour v2** :

- **DevTools** : sub à `mutations$` pour récupérer les actions (nom dérivé de la stack), sub à `state$` pour snapshot après chaque commit. Pas de monkey-patch de `patchState`.
- **`rxMethod`** : pipeline RxJS qui peut subscriber à `state$` pour ses dépendances, et pousser via `mutations$.next(...)` pour ses effets de bord. Naturel parce que les channels sont déjà des `Subject`/`BehaviorSubject`.
- **`withHooks({ onInit, onDestroy })`** : `onDestroy` se branche directement sur `cleanup.add(() => fn())`. `onInit` peut recevoir un snapshot brut de `state$.value`.
- **Persistence/time-travel** : `state$.value` est JSON-sérialisable (state brut), `localStorage.setItem` + `state$.next(parsed)` pour restore. Snapshots = `[]` qui accumule des `state$.value` à chaque mutation.

**Trade-off** : rxjs est passé de "package v2" à "peer dep du core". Bundle size du core mesuré 1.3kb gzip (rxjs étant peer dep, n'est pas compté dans le bundle de la lib). Le consommateur paie rxjs dans son app — mais en pratique l'écosystème React qui voudrait cette lib a déjà rxjs (ngrx interop, rxjs-react, etc.).

## 6. Exemple complet attendu

```ts
import { signalStore, withState, withComputed, withMethods, patchState } from '@fluch/signal-store';
import { withEntities, addEntity, updateEntity, removeEntity, setAllEntities } from '@fluch/signal-store-entities';
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

### Infrastructure vitest

Pas de `projects` field dans [vitest.config.ts](vitest.config.ts) tant que tous les packages tournent dans le même environnement (node, sans setupFile, sans transformer custom). La config racine suffit — vitest découvre tous les `packages/*/src/**/*.test.ts` via le pattern par défaut `**/*.{test,spec}.?(c|m)[jt]s?(x)`.

**À introduire quand** :

- `@fluch/signal-store-react` ajoute des tests de composants (@testing-library/react) → besoin d'`environment: 'jsdom'` ou `'happy-dom'` pour ce package uniquement, core et entities restent en node.
- Un package nécessite un setupFile spécifique (mocks globaux, polyfills, matchers custom).
- Un package a besoin d'un transformer / d'aliases qui diffèrent des autres.

**Pattern à appliquer** : ajouter `projects: ['packages/*']` dans le `test` block de [vitest.config.ts](vitest.config.ts) racine + créer un `vitest.config.ts` local au(x) package(s) concerné(s) avec ses overrides (environment, setupFiles, etc.). Ne **pas** réintroduire un fichier `vitest.workspace.ts` séparé — c'était l'API vitest ≤ 3, supprimée en vitest 4 au profit du champ `projects`.

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

## 8. Sécurité & maintenance des dépendances

### 8.1. Dependabot

Schedule **hebdomadaire** (lundi matin) sur deux écosystèmes :

- `npm` — racine du monorepo, scan automatique des workspaces.
- `github-actions` — versions des actions épinglées dans les workflows CI/release/déploiement.

Configuration `.github/dependabot.yml` :

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    groups:
      dev-dependencies:
        dependency-type: "development"
        update-types: ["minor", "patch"]
      production-patches:
        dependency-type: "production"
        update-types: ["patch"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
```

Le grouping fusionne plusieurs bumps en une seule PR pour limiter le bruit (sinon 1 PR par dep et par semaine).

### 8.2. Audit CI bloquant

Job ajouté au workflow CI (`.github/workflows/ci.yml`) :

```yaml
audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - name: Audit (block on high+critical)
      run: pnpm audit --audit-level=high
    - name: Audit moderate (warn-only)
      if: success() || failure()
      continue-on-error: true
      run: pnpm audit --audit-level=moderate
```

- Premier step : exit non-zéro si vulnérabilité **high** ou **critical** → la PR ne peut pas être mergée.
- Second step : list les **moderate** sans bloquer (visibilité).
- Job ajouté aux **required status checks** de la branche `main` côté GitHub Settings.

### 8.3. Auto-merge des PR Dependabot

Workflow `.github/workflows/dependabot-auto-merge.yml`. Auto-merge :

- les bumps **patch** sur toutes les dépendances ;
- les bumps **minor** sur les dépendances **de développement** uniquement.

Conditions : auteur = `dependabot[bot]`, tous les status checks verts (CI + audit). Les bumps **major**, ou **minor sur prod-deps**, restent en review manuelle (risque de breaking change).

```yaml
name: Dependabot auto-merge
on: pull_request_target
permissions:
  contents: write
  pull-requests: write
jobs:
  auto-merge:
    if: github.event.pull_request.user.login == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - id: meta
        uses: dependabot/fetch-metadata@v2
      - if: |
          steps.meta.outputs.update-type == 'version-update:semver-patch' ||
          (steps.meta.outputs.update-type == 'version-update:semver-minor' &&
           steps.meta.outputs.dependency-type == 'direct:development')
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 9. Documentation — site Starlight

### 9.1. Emplacement & stack

Workspace dédié [apps/docs/](apps/docs/), **privé** (`"private": true` dans son `package.json`, jamais publié sur npm).

Stack :

- **Astro + Starlight** — site statique, MDX-first, sidebar/search/themes intégrés, perfs excellentes.
- **starlight-typedoc** — plugin officiel qui transforme la sortie TypeDoc en pages MDX directement consommables par Starlight (navigation, linking croisé corrects).
- **TypeDoc** — extraction de la référence API depuis les sources des trois packages publics.

Le glob `apps/*` est ajouté au [pnpm-workspace.yaml](pnpm-workspace.yaml) pour que pnpm pickup le workspace.

### 9.2. Structure de contenu

```
apps/docs/
├── astro.config.mjs        ← config Starlight + starlight-typedoc + sidebar
├── package.json            ← privé, deps: astro, @astrojs/starlight, starlight-typedoc, typedoc
├── typedoc.json            ← entry points des 3 packages
├── public/
│   └── CNAME               ← fluch.dev (à ajouter quand le domaine sera enregistré)
└── src/
    └── content/
        └── docs/
            ├── index.mdx                  ← landing (placeholder v1, version finale plus tard)
            ├── getting-started/
            │   ├── installation.mdx
            │   └── first-store.mdx
            ├── guides/                    ← blog & tutoriaux (placeholder v1, contenu plus tard)
            ├── packages/
            │   ├── core.mdx               ← présentation @fluch/signal-store
            │   ├── entities.mdx           ← présentation @fluch/signal-store-entities
            │   └── react.mdx              ← présentation @fluch/signal-store-react
            └── api/                       ← généré par starlight-typedoc, NON commit (gitignore)
```

Sidebar Starlight (déclarée dans `astro.config.mjs`) :

1. **Getting started** — installation, premier store
2. **Guides** — vide en v1, structure prête à recevoir blog/tutoriaux
3. **Packages** — une page par package (core, entities, react), exemples + surface API
4. **API Reference** — auto-généré par `starlight-typedoc`, non éditable manuellement

### 9.3. TypeDoc

Configuration `apps/docs/typedoc.json` :

```json
{
  "entryPoints": [
    "../../packages/core/src/index.ts",
    "../../packages/entities/src/index.ts",
    "../../packages/react/src/index.ts"
  ],
  "entryPointStrategy": "expand",
  "tsconfig": "../../tsconfig.base.json",
  "excludeInternal": true,
  "excludePrivate": true
}
```

`starlight-typedoc` est branché dans `astro.config.mjs` avec ces entryPoints et écrit dans `src/content/docs/api/` au moment du build.

### 9.4. Build & déploiement — GitHub Pages

**Choix retenu : GitHub Pages.** Justification :

- aucune dépendance externe (pas de compte Cloudflare/Vercel à gérer) ;
- workflow GitHub Actions natif (`actions/configure-pages`, `actions/deploy-pages`) ;
- custom domain trivial (fichier `public/CNAME` + record DNS) ;
- bande passante / quota largement suffisants pour une doc de lib OSS.

**Trade-off accepté** : pas de preview deployment par PR. Si ce besoin émerge plus tard, bascule possible vers Cloudflare Pages en ~10 min de config — non bloquant pour v1.

Workflow `.github/workflows/deploy-docs.yml` :

- déclenché sur `push` vers `main` quand `apps/docs/**`, `packages/**/src/**`, `packages/**/package.json` ou `pnpm-lock.yaml` changent ;
- `workflow_dispatch` aussi pour redéploiement manuel ;
- jobs : install → typedoc + astro build → upload artifact → `actions/deploy-pages`.

Activation côté repo (à faire **manuellement** une fois après merge) : Settings → Pages → Source = "GitHub Actions".

### 9.5. Versioning de la doc

**Latest only en v1.** La doc reflète la dernière version publiée sur `main`, pas de snapshot par version majeure.

Quand v2 arrivera (breaking changes), bascule vers [`starlight-versions`](https://starlight-versions.netlify.app/) ou snapshot figé sous `/v1/`. Migration locale au site, pas à la lib — pas de dette technique embarquée dans v1.

### 9.6. Domaine

V1 : URL GitHub Pages par défaut (`clemparpa.github.io/signal-store` ou équivalent), pas de custom domain. Le fichier `public/CNAME` + DNS seront ajoutés quand `fluch.dev` sera enregistré. Pas de blocage v1.

### 9.7. Langue

**EN par défaut** (public international). L'i18n Starlight (FR notamment) sera évalué après v1 selon traffic et retours.

## 10. Hors scope v1 — design préliminaire pour v2

À documenter mais NE PAS implémenter (sauf le premier item qui est ✅ déjà livré dans v1) :

- **✅ Refactor archi interne — source brute + signaux en facade** : **livré dans v1** (cf. §5.5). Initialement prévu en tête de v2, fait dans le périmètre v1 parce que le coût de migration grossissait avec chaque test ajouté. L'API publique (`store.count.value`, `patchState(store, ...)`) n'a pas bougé. Les autres items v2 ci-dessous s'appuient sur cette base.
- **✅ `withHooks({ onInit, onDestroy })`** : **livré dans v2 (branche `feat/with-hooks`, cf. §4.8)**. `onInit` drainé à la fin de `signalStore(...)` (voit le store complet). `onDestroy` enregistré sur `cleanup: Subscription` du §5.5 en LIFO (déclenché par `destroyStore` ou automatiquement à l'unmount Provider). Premier chantier v2 — c'est un pré-requis ergonomique pour `rxMethod` (teardown des pipelines) et `devtools` (registration au init).
- **✅ `rxMethod` + `toObservable`** : **livré dans v2 (branche `feat/rx-method`, cf. §4.9, §4.10)**. Prend `(store, generator)` et expose une méthode acceptant scalaire / `Signal<T>` / `Observable<T>`. Pipeline subscribed une fois sur un `Subject<Input>` central — opérateurs stateful corrects entre invocations. Auto-cleanup via `meta.cleanup` (idem `withHooks.onDestroy`). Post-destroy : silent no-op. **Décision livraison vs spec initiale** : pas de package séparé `@fluch/signal-store-rxjs`. Justification d'origine (= laisser le core rxjs-free) caduque depuis le refactor §5.5 qui a fait `rxjs` peer dep obligatoire du core ; séparer ne ferait plus rien gagner (rxjs déjà payé côté consommateur, tree-shake gère le code-size). `rxMethod` vit donc dans `@fluch/signal-store`, à côté de `withMethods`. `toSignal(observable, initial)` (inverse) reporté — cleanup non-trivial pour Observable infini, pas de cas d'usage exprimé.
- **✅ DevTools** : **livré dans v2 (branche `feat/devtools`, cf. §4.11)**. Sub à `mutations$` pour relayer chaque commit (nom dérivé de la stack via parsing V8/SpiderMonkey, fallback `STATE_UPDATE`), lit `meta.state$.value` pour le snapshot post-commit. Pas de monkey-patch de `patchState`. **Décision livraison vs spec initiale** : package séparé conservé — contrairement à `rxMethod`, devtools est strictement dev-only et le tree-shake d'un guard `if (DEV) connectDevtools(...)` élimine entièrement l'import en prod. Le bridge accède à `getMeta` via un nouveau subpath `@fluch/signal-store/internal` (convention Vue/Vite) plutôt que d'élargir la surface publique du core. **Mode** : monitor-only — time travel (`JUMP_TO_STATE`/`JUMP_TO_ACTION`) et dispatcher (actions UI → store) reportés ; exigent une registry d'actions + un historique des deltas, design non trivial.
- **Sort comparator entities** : option `sortComparer` ajoutée à `entityConfig`. Auto-tri à chaque insert/update. Implémentation : le `<C>Entities` computed applique le `sortComparer` sur le `<C>Ids.map(id => map[id])` si présent dans le cfg.

## 11. Livraison v1 — historique

v1.0.0 publiée le **2026-05-12** (`@fluch/signal-store@0.3.1`, `@fluch/signal-store-entities@0.1.1`, `@fluch/signal-store-react@0.1.1`). Items cochés au moment de la livraison.

Deux additions **post-spec** ont été apportées pour préparer la v2 sereinement :

- **Refactor signal-facade over raw rxjs source** (cf. §5.5) — initialement prévu en début de v2, fait dans le périmètre v1 parce que le coût de migration grossissait avec chaque test ajouté. Ajout de `rxjs ^7.8.0` en peer dep du core.
- **`destroyStore`** (cf. §4.7) — nouveau public API non listé dans la spec initiale. Nécessaire dès qu'on a un pipeline rxjs (sinon fuite de subscriptions à l'unmount du Provider React).

Checklist d'origine, telle que cochée à la livraison :

- [x] Repo monorepo pnpm initialisé, workspaces configurés
- [x] `@fluch/signal-store` (core) : signalStore, withState, withComputed, withMethods, patchState
- [x] `@fluch/signal-store-entities` : withEntities (mono + multi), tous les updaters listés en 4.6
- [x] `@fluch/signal-store-react` : Provider + useStore (mode B)
- [x] Types parfaitement inférés sans annotation manuelle
- [x] Tests vitest >90% coverage sur core + entities
- [x] Build tsup ESM+CJS+dts, treeshakeable
- [x] README dans chaque package avec exemple minimal
- [x] `.changeset/` configuré pour publication
- [x] CI GitHub Actions : lint + typecheck + test + build + audit
- [x] Dependabot actif (npm + github-actions, weekly, grouped)
- [x] Audit CI bloquant high + critical, alerte moderate
- [x] Auto-merge Dependabot configuré (patch toutes deps, minor dev-deps)
- [x] Site doc Starlight déployé sur GitHub Pages (intro packages + API ref TypeDoc)
- [x] Bundle size cible : core <3kb gzip, entities <2kb gzip (mesuré : core 1.3kb, entities 1.3kb)
