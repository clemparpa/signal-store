const isProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

export function devFreeze<T>(value: T): T {
  if (isProd) return value;
  return freezeDeep(value, new WeakSet());
}

function freezeDeep<T>(value: T, visited: WeakSet<object>): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (visited.has(value as object)) return value;
  visited.add(value as object);
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    freezeDeep((value as Record<string, unknown>)[key], visited);
  }
  return value;
}
