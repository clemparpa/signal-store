import { destroyStore, patchState, signalStore, withMethods, withState } from '@fluch/signal-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectDevtools } from './connect-devtools';
import type {
  DevtoolsConnectOptions,
  DevtoolsInstance,
  ReduxDevtoolsExtension,
} from './redux-devtools-types';

type ConnSpy = {
  init: ReturnType<typeof vi.fn<DevtoolsInstance['init']>>;
  send: ReturnType<typeof vi.fn<DevtoolsInstance['send']>>;
  subscribe: ReturnType<typeof vi.fn<DevtoolsInstance['subscribe']>>;
  unsubscribe: ReturnType<typeof vi.fn<DevtoolsInstance['unsubscribe']>>;
  error: ReturnType<typeof vi.fn<DevtoolsInstance['error']>>;
  connectOptions: DevtoolsConnectOptions | undefined;
};

function makeExtension(): { ext: ReduxDevtoolsExtension; connections: ConnSpy[] } {
  const connections: ConnSpy[] = [];
  const ext: ReduxDevtoolsExtension = {
    connect(options) {
      const spy: ConnSpy = {
        init: vi.fn<DevtoolsInstance['init']>(),
        send: vi.fn<DevtoolsInstance['send']>(),
        subscribe: vi.fn<DevtoolsInstance['subscribe']>(() => () => {}),
        unsubscribe: vi.fn<DevtoolsInstance['unsubscribe']>(),
        error: vi.fn<DevtoolsInstance['error']>(),
        connectOptions: options,
      };
      connections.push(spy);
      const inst: DevtoolsInstance = {
        init: spy.init,
        send: spy.send,
        subscribe: spy.subscribe,
        unsubscribe: spy.unsubscribe,
        error: spy.error,
      };
      return inst;
    },
    disconnect: vi.fn(),
  };
  return { ext, connections };
}

function installExtension(ext?: ReduxDevtoolsExtension): void {
  vi.stubGlobal('window', ext === undefined ? {} : { __REDUX_DEVTOOLS_EXTENSION__: ext });
}

function firstConn(connections: ConnSpy[]): ConnSpy {
  const conn = connections[0];
  if (conn === undefined) throw new Error('expected at least one DevTools connection');
  return conn;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('connectDevtools — guards', () => {
  it('is a silent no-op when no extension is installed', () => {
    installExtension(undefined);
    const store = signalStore(withState({ count: 0 }));
    expect(() => connectDevtools(store)).not.toThrow();
    const conn = connectDevtools(store);
    expect(typeof conn.disconnect).toBe('function');
    expect(() => conn.disconnect()).not.toThrow();
  });

  it('is a silent no-op when the store has already been destroyed', () => {
    const { ext, connections } = makeExtension();
    installExtension(ext);
    const store = signalStore(withState({ count: 0 }));
    destroyStore(store);
    const conn = connectDevtools(store);
    expect(connections).toHaveLength(0);
    expect(() => conn.disconnect()).not.toThrow();
  });

  it('throws when called with a non-store object', () => {
    const { ext } = makeExtension();
    installExtension(ext);
    expect(() => connectDevtools({})).toThrow(/signalStore/);
  });
});

describe('connectDevtools — relaying mutations', () => {
  it('calls init() with the current state snapshot', () => {
    const { ext, connections } = makeExtension();
    installExtension(ext);
    const store = signalStore(withState({ count: 5, name: 'foo' }));
    connectDevtools(store);
    expect(connections).toHaveLength(1);
    const conn = firstConn(connections);
    expect(conn.init).toHaveBeenCalledTimes(1);
    expect(conn.init).toHaveBeenCalledWith({ count: 5, name: 'foo' });
  });

  it('sends one action per patchState call with post-commit state', () => {
    const { ext, connections } = makeExtension();
    installExtension(ext);
    const store = signalStore(withState({ count: 0 }));
    connectDevtools(store);
    const conn = firstConn(connections);
    conn.send.mockClear();

    patchState(store, { count: 1 });
    patchState(store, { count: 2 });
    patchState(store, { count: 3 });

    expect(conn.send).toHaveBeenCalledTimes(3);
    expect(conn.send.mock.calls[0]?.[1]).toEqual({ count: 1 });
    expect(conn.send.mock.calls[1]?.[1]).toEqual({ count: 2 });
    expect(conn.send.mock.calls[2]?.[1]).toEqual({ count: 3 });
  });

  it('sends one action per update in a multi-update patchState call', () => {
    const { ext, connections } = makeExtension();
    installExtension(ext);
    const store = signalStore(withState({ count: 0, name: 'init' }));
    connectDevtools(store);
    const conn = firstConn(connections);
    conn.send.mockClear();

    patchState(store, { count: 1 }, { name: 'go' });

    expect(conn.send).toHaveBeenCalledTimes(2);
    expect(conn.send.mock.calls[0]?.[1]).toEqual({ count: 1, name: 'init' });
    expect(conn.send.mock.calls[1]?.[1]).toEqual({ count: 1, name: 'go' });
  });

  it('forwards options.name to the extension', () => {
    const { ext, connections } = makeExtension();
    installExtension(ext);
    const store = signalStore(withState({ count: 0 }));
    connectDevtools(store, { name: 'CounterStore', maxAge: 10 });
    expect(connections[0]?.connectOptions?.name).toBe('CounterStore');
    expect(connections[0]?.connectOptions?.maxAge).toBe(10);
  });
});

describe('connectDevtools — action naming', () => {
  it('derives a non-fallback action name from a named caller', () => {
    const { ext, connections } = makeExtension();
    installExtension(ext);
    const store = signalStore(
      withState({ count: 0 }),
      withMethods((s) => ({
        myIncrement: () => patchState(s, { count: s.count.value + 1 }),
      })),
    );
    connectDevtools(store);
    const conn = firstConn(connections);
    conn.send.mockClear();

    store.myIncrement();

    expect(conn.send).toHaveBeenCalledTimes(1);
    const action = conn.send.mock.calls[0]?.[0] as { type: string };
    // Stack-derived names depend on the engine; we only assert it's not the fallback
    // and matches a reasonable identifier shape.
    expect(action.type).not.toBe('STATE_UPDATE');
    expect(action.type).toMatch(/^[A-Za-z_$][\w$]*$/);
  });

  it('uses STATE_UPDATE when trace is disabled', () => {
    const { ext, connections } = makeExtension();
    installExtension(ext);
    const store = signalStore(withState({ count: 0 }));
    connectDevtools(store, { trace: false });
    const conn = firstConn(connections);
    conn.send.mockClear();

    patchState(store, { count: 1 });

    expect(conn.send).toHaveBeenCalledTimes(1);
    expect(conn.send.mock.calls[0]?.[0]).toEqual({ type: 'STATE_UPDATE' });
  });
});

describe('connectDevtools — lifecycle', () => {
  it('stops relaying after disconnect()', () => {
    const { ext, connections } = makeExtension();
    installExtension(ext);
    const store = signalStore(withState({ count: 0 }));
    const conn = connectDevtools(store);
    const spy = firstConn(connections);
    spy.send.mockClear();

    patchState(store, { count: 1 });
    expect(spy.send).toHaveBeenCalledTimes(1);

    conn.disconnect();
    patchState(store, { count: 2 });
    expect(spy.send).toHaveBeenCalledTimes(1);
  });

  it('disconnect() is idempotent', () => {
    const { ext } = makeExtension();
    installExtension(ext);
    const store = signalStore(withState({ count: 0 }));
    const conn = connectDevtools(store);
    expect(() => {
      conn.disconnect();
      conn.disconnect();
    }).not.toThrow();
  });

  it('auto-detaches when the store is destroyed', () => {
    const { ext, connections } = makeExtension();
    installExtension(ext);
    const store = signalStore(withState({ count: 0 }));
    connectDevtools(store);
    const spy = firstConn(connections);
    spy.send.mockClear();

    patchState(store, { count: 1 });
    expect(spy.send).toHaveBeenCalledTimes(1);

    destroyStore(store);
    // After destroy, patchState is a no-op — nothing should reach the extension.
    patchState(store, { count: 99 });
    expect(spy.send).toHaveBeenCalledTimes(1);
  });

  it('keeps multiple stores isolated in their own DevTools connections', () => {
    const { ext, connections } = makeExtension();
    installExtension(ext);
    const a = signalStore(withState({ a: 0 }));
    const b = signalStore(withState({ b: 0 }));
    connectDevtools(a, { name: 'A' });
    connectDevtools(b, { name: 'B' });
    expect(connections).toHaveLength(2);

    patchState(a, { a: 1 });
    patchState(b, { b: 1 });

    expect(connections[0]?.send).toHaveBeenCalledTimes(1);
    expect(connections[0]?.send.mock.calls[0]?.[1]).toEqual({ a: 1 });
    expect(connections[1]?.send).toHaveBeenCalledTimes(1);
    expect(connections[1]?.send.mock.calls[0]?.[1]).toEqual({ b: 1 });
  });
});
