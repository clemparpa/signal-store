/**
 * Internal entry point for tooling packages (devtools, plugins, etc.).
 *
 * The exports here are NOT part of the stable public API and may change
 * without a semver-major bump. Application code should never import from
 * `@fluch/signal-store/internal` — only first-party tooling packages do.
 *
 * @internal
 */

export { getMeta, META, type Mutation, type StoreMeta } from './store-meta';
