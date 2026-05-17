/**
 * Minimal typings for the Redux DevTools Extension's `connect()` API.
 *
 * We declare these locally instead of depending on `@redux-devtools/extension`
 * — that package would add weight and version drift for ~30 lines of types.
 *
 * Reference: https://github.com/reduxjs/redux-devtools/tree/main/extension
 */

export type DevtoolsAction = { type: string } | string;

export type DevtoolsInstance = {
  init(state: unknown): void;
  send(action: DevtoolsAction, state: unknown): void;
  subscribe(listener: (msg: unknown) => void): () => void;
  unsubscribe(): void;
  error(msg?: string): void;
};

export type DevtoolsFeatures = {
  pause?: boolean;
  lock?: boolean;
  persist?: boolean;
  export?: boolean;
  import?: boolean | 'custom';
  jump?: boolean;
  skip?: boolean;
  reorder?: boolean;
  dispatch?: boolean;
  test?: boolean;
};

export type DevtoolsConnectOptions = {
  name?: string;
  instanceId?: string;
  maxAge?: number;
  trace?: boolean | (() => string);
  serialize?: boolean | object;
  features?: DevtoolsFeatures;
};

export type ReduxDevtoolsExtension = {
  connect(options?: DevtoolsConnectOptions): DevtoolsInstance;
  disconnect(): void;
};
