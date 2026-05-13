# `@fluch/signal-store` — Spécification v1

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
    │   peer: @preact/signals-core
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

### 4.6. `withEntities` (package `@fluch/signal-store-entities`)

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

À documenter mais NE PAS implémenter :

- **Refactor archi interne — source brute + signaux en facade** (à faire AVANT toute feature v2) : le store v1 stocke les valeurs directement dans des Signal (signal-first). Pour les features v2 (devtools, hooks, persistence, time-travel), il faut basculer vers le modèle NgRx : un objet brut `rawState` détient la source de vérité, les signaux deviennent une facade en lecture qui se met à jour quand `patchState` écrit dans `rawState`. Bénéfices : (a) sérialisation triviale du state pour devtools et localStorage, (b) snapshot/restore en O(1) pour time-travel, (c) `onInit` peut recevoir l'objet brut, (d) base saine pour distinguer state vs computed vs methods en interne (besoin pour devtools qui ne doit serialiser que le state). Le refactor est interne — l'API publique (`store.count.value`, `patchState(store, ...)`) ne change pas. Une PR dédiée `refactor: signal facade over raw source`, sans nouvelles features.
- **`rxMethod`** : prend un input (`Signal<T> | Observable<T> | T`), un pipeline RxJS, exécute. Source : `@ngrx/signals/rxjs-interop`. Helpers `toObservable(signal)` et `toSignal(observable)` à porter (~20 lignes chacun avec Preact signals).
- **`withHooks({ onInit, onDestroy })`** : `onInit` au premier accès au store (singleton) ou au mount du Provider (mode B). `onDestroy` uniquement en mode B (unmount Provider).
- **DevTools** : intercepter chaque `patchState`, push dans Redux DevTools extension avec un nom d'action dérivé de la stack (`addTodo`, `setFilter`).
- **Sort comparator entities** : option `sortComparer` dans `withEntities`. Auto-tri à chaque insert/update.

## 11. Checklist de livraison v1

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
