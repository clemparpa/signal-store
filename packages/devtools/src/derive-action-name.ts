const FALLBACK = 'STATE_UPDATE';

const SKIP_PATTERNS: RegExp[] = [
  /derive-action-name(?!\.test)/,
  /connect-devtools(?!\.test)/,
  /\bpatchState\b/,
  /\/rxjs\//,
  /node_modules/,
  /node:internal/,
];

const V8_FRAME = /\s+at\s+([^\s(]+)\s*\(/;
const MOZ_FRAME = /^\s*([^@\s]+)@/;

/**
 * Derive an action label from a JS stack trace.
 *
 * Parses the first stack frame that doesn't belong to signal-store internals,
 * RxJS, or node_modules, and returns the function name found there. Returns
 * `'STATE_UPDATE'` as a fallback when:
 *
 * - the engine doesn't expose `Error.stack` (rare),
 * - every frame is filtered out,
 * - the matching frame is anonymous.
 *
 * Supports both V8 (`at fnName (file:line:col)`) and SpiderMonkey/JSCore
 * (`fnName@file:line:col`) formats. In minified production builds, returned
 * names will be the mangled identifiers (`a`, `b`, …) — disable via
 * `trace: false` on {@link connectDevtools} if that is undesirable.
 *
 * @param stack — the value of `new Error().stack` captured at the call site.
 *   Passing `undefined` returns the fallback.
 */
export function deriveActionName(stack: string | undefined): string {
  if (!stack) return FALLBACK;

  for (const line of stack.split('\n')) {
    if (SKIP_PATTERNS.some((re) => re.test(line))) continue;

    const v8 = V8_FRAME.exec(line);
    if (v8?.[1] !== undefined) {
      const name = stripObjectPrefix(v8[1]);
      if (name && name !== '<anonymous>') return name;
      continue;
    }

    const moz = MOZ_FRAME.exec(line);
    if (moz?.[1] !== undefined && moz[1].length > 0) return moz[1];
  }

  return FALLBACK;
}

function stripObjectPrefix(raw: string): string {
  const dot = raw.lastIndexOf('.');
  return dot === -1 ? raw : raw.slice(dot + 1);
}
