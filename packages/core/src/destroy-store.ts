import { getMeta } from './store-meta';

export function destroyStore(store: object): void {
  const meta = getMeta(store);
  if (meta !== undefined) meta.destroy();
}
