import { describe, expect, it } from 'vitest';
import { deriveActionName } from './derive-action-name';

const V8_INCREMENT = `Error
    at deriveActionName (/repo/packages/devtools/src/derive-action-name.ts:18:5)
    at /repo/packages/devtools/src/connect-devtools.ts:42:33
    at patchState (/repo/packages/core/src/patch-state.ts:47:24)
    at Object.increment (/repo/example/app.ts:12:5)
    at runMain (/repo/example/main.ts:3:3)`;

const V8_ANONYMOUS = `Error
    at deriveActionName (/repo/packages/devtools/src/derive-action-name.ts:18:5)
    at patchState (/repo/packages/core/src/patch-state.ts:47:24)
    at /repo/example/app.ts:8:11
    at /repo/example/main.ts:3:3`;

const V8_OBJECT_METHOD = `Error
    at patchState (/repo/packages/core/src/patch-state.ts:47:24)
    at Object.setFilter (/repo/example/app.ts:20:5)`;

const MOZ_FRAME_STACK = `deriveActionName@/repo/packages/devtools/src/derive-action-name.ts:18:5
patchState@/repo/packages/core/src/patch-state.ts:47:24
loadUser@/repo/example/app.ts:30:9
runMain@/repo/example/main.ts:3:3`;

const RXJS_FRAMES_ONLY = `Error
    at deriveActionName (/repo/packages/devtools/src/derive-action-name.ts:18:5)
    at patchState (/repo/packages/core/src/patch-state.ts:47:24)
    at SafeSubscriber._next (/repo/node_modules/rxjs/dist/Subscriber.js:200:1)`;

describe('deriveActionName', () => {
  it('returns the fallback for missing stack', () => {
    expect(deriveActionName(undefined)).toBe('STATE_UPDATE');
    expect(deriveActionName('')).toBe('STATE_UPDATE');
  });

  it('returns the first non-internal V8 frame function name', () => {
    expect(deriveActionName(V8_INCREMENT)).toBe('increment');
  });

  it('strips Object. prefixes from V8 frames', () => {
    expect(deriveActionName(V8_OBJECT_METHOD)).toBe('setFilter');
  });

  it('skips anonymous V8 frames and returns the fallback', () => {
    expect(deriveActionName(V8_ANONYMOUS)).toBe('STATE_UPDATE');
  });

  it('parses Spidermonkey/JSCore frames', () => {
    expect(deriveActionName(MOZ_FRAME_STACK)).toBe('loadUser');
  });

  it('returns the fallback when only RxJS/node_modules frames remain', () => {
    expect(deriveActionName(RXJS_FRAMES_ONLY)).toBe('STATE_UPDATE');
  });

  it('returns a single-letter name for minified stacks (best-effort)', () => {
    const minified = `Error
    at deriveActionName (/repo/packages/devtools/src/derive-action-name.ts:18:5)
    at patchState (/repo/packages/core/src/patch-state.ts:47:24)
    at a (/static/chunk.abc.js:1:5234)`;
    expect(deriveActionName(minified)).toBe('a');
  });
});
