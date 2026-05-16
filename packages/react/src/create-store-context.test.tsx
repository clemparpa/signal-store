import { patchState, signalStore, withHooks, withMethods, withState } from '@fluch/signal-store';
import type { ReadonlySignal, Signal } from '@preact/signals-core';
import { act, render, renderHook, screen } from '@testing-library/react';
import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createStoreContext } from './create-store-context';

function useSignalValue<T>(sig: Signal<T> | ReadonlySignal<T>): T {
  const [value, setValue] = useState<T>(sig.peek());
  useEffect(() => sig.subscribe(setValue), [sig]);
  return value;
}

const makeCounterStore = () =>
  signalStore(
    withState({ count: 0 }),
    withMethods((s) => ({
      increment: () => patchState(s, { count: s.count.value + 1 }),
    })),
  );

describe('createStoreContext — Provider', () => {
  it('renders children', () => {
    const { Provider } = createStoreContext(makeCounterStore);
    render(
      <Provider>
        <span data-testid="child">hello</span>
      </Provider>,
    );
    expect(screen.getByTestId('child').textContent).toBe('hello');
  });

  it('calls the factory exactly once per mount, not on re-render', () => {
    const factory = vi.fn(makeCounterStore);
    const { Provider, useStore } = createStoreContext(factory);

    function Display({ tick }: { tick: number }): ReactElement {
      const store = useStore();
      return <span data-testid="row">{`${tick}:${store.count.value}`}</span>;
    }

    function Harness(): ReactElement {
      const [tick, setTick] = useState(0);
      return (
        <Provider>
          <button type="button" onClick={() => setTick((t) => t + 1)} data-testid="bump">
            bump
          </button>
          <Display tick={tick} />
        </Provider>
      );
    }

    render(<Harness />);
    expect(factory).toHaveBeenCalledTimes(1);

    act(() => {
      screen.getByTestId('bump').click();
      screen.getByTestId('bump').click();
    });

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('passes Provider props to the factory at mount time', () => {
    const factory = vi.fn((props: { initial: number }) =>
      signalStore(withState({ count: props.initial })),
    );
    const { Provider, useStore } = createStoreContext(factory);

    function Display(): ReactElement {
      const store = useStore();
      return <span data-testid="value">{store.count.value}</span>;
    }

    render(
      <Provider initial={42}>
        <Display />
      </Provider>,
    );

    expect(factory).toHaveBeenCalledWith({ initial: 42 });
    expect(screen.getByTestId('value').textContent).toBe('42');
  });

  it('ignores prop changes after mount (read-once semantics)', () => {
    const factory = vi.fn((props: { initial: number }) =>
      signalStore(withState({ count: props.initial })),
    );
    const { Provider, useStore } = createStoreContext(factory);

    function Display(): ReactElement {
      const store = useStore();
      return <span data-testid="value">{store.count.value}</span>;
    }

    const { rerender } = render(
      <Provider initial={10}>
        <Display />
      </Provider>,
    );
    expect(screen.getByTestId('value').textContent).toBe('10');

    rerender(
      <Provider initial={999}>
        <Display />
      </Provider>,
    );

    expect(factory).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('value').textContent).toBe('10');
  });

  it('creates a fresh store when the Provider is remounted via `key`', () => {
    const factory = vi.fn((props: { initial: number }) =>
      signalStore(withState({ count: props.initial })),
    );
    const { Provider, useStore } = createStoreContext(factory);

    function Display(): ReactElement {
      const store = useStore();
      return <span data-testid="value">{store.count.value}</span>;
    }

    const { rerender } = render(
      <Provider key="a" initial={10}>
        <Display />
      </Provider>,
    );
    expect(screen.getByTestId('value').textContent).toBe('10');

    rerender(
      <Provider key="b" initial={20}>
        <Display />
      </Provider>,
    );
    expect(factory).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('value').textContent).toBe('20');
  });
});

describe('createStoreContext — useStore', () => {
  it('returns the store provided by the surrounding Provider', () => {
    const { Provider, useStore } = createStoreContext(makeCounterStore);
    const wrapper = ({ children }: { children: ReactNode }) => <Provider>{children}</Provider>;

    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current.count.value).toBe(0);

    act(() => {
      result.current.increment();
    });
    expect(result.current.count.value).toBe(1);
  });

  it('throws a descriptive error when called outside its Provider', () => {
    const { useStore } = createStoreContext(makeCounterStore);
    expect(() => renderHook(() => useStore())).toThrow(/must be called inside its <Provider>/);
  });

  it('keeps two unrelated contexts fully isolated', () => {
    const ctxA = createStoreContext(makeCounterStore);
    const ctxB = createStoreContext(makeCounterStore);

    function Row(): ReactElement {
      const a = ctxA.useStore();
      const b = ctxB.useStore();
      return <span data-testid="row">{`${a.count.value}|${b.count.value}`}</span>;
    }

    render(
      <ctxA.Provider>
        <ctxB.Provider>
          <Row />
        </ctxB.Provider>
      </ctxA.Provider>,
    );

    expect(screen.getByTestId('row').textContent).toBe('0|0');
  });

  it('resolves the nearest Provider when the same context is nested', () => {
    const { Provider, useStore } = createStoreContext((props: { initial: number }) =>
      signalStore(withState({ count: props.initial })),
    );

    function Display(): ReactElement {
      const store = useStore();
      return <span data-testid="row">{store.count.value}</span>;
    }

    render(
      <Provider initial={1}>
        <Provider initial={2}>
          <Display />
        </Provider>
      </Provider>,
    );

    expect(screen.getByTestId('row').textContent).toBe('2');
  });
});

describe('createStoreContext — cleanup on unmount', () => {
  it('tears down the store pipeline when the Provider unmounts', () => {
    let captured: ReturnType<typeof makeCounterStore> | null = null;
    const factory = () => {
      captured = makeCounterStore();
      return captured;
    };

    const { Provider } = createStoreContext(factory);
    const { unmount } = render(
      <Provider>
        <span>x</span>
      </Provider>,
    );

    if (captured === null) throw new Error('factory did not run');
    const store = captured as ReturnType<typeof makeCounterStore>;
    expect(store.count.value).toBe(0);

    unmount();

    patchState(store, { count: 999 });
    expect(store.count.value).toBe(0);
  });
});

describe('createStoreContext — withHooks integration', () => {
  it('calls onInit at mount and onDestroy at unmount', () => {
    const onInit = vi.fn();
    const onDestroy = vi.fn();
    const factory = () => signalStore(withState({ count: 0 }), withHooks({ onInit, onDestroy }));

    const { Provider } = createStoreContext(factory);
    const { unmount } = render(
      <Provider>
        <span>x</span>
      </Provider>,
    );

    expect(onInit).toHaveBeenCalledTimes(1);
    expect(onDestroy).not.toHaveBeenCalled();

    unmount();

    expect(onInit).toHaveBeenCalledTimes(1);
    expect(onDestroy).toHaveBeenCalledTimes(1);

    const destroyedStore = onDestroy.mock.calls[0]?.[0] as { count: { value: number } };
    expect(destroyedStore.count.value).toBe(0);
  });

  it('runs the full lifecycle: onInit patches state, children render it, onDestroy reads the final value', () => {
    const seenAtDestroy = vi.fn<(final: number) => void>();
    const factory = (props: { initial: number }) =>
      signalStore(
        withState({ count: props.initial }),
        withMethods((s) => ({
          increment: () => patchState(s, { count: s.count.value + 1 }),
        })),
        withHooks({
          onInit(s) {
            patchState(s, { count: s.count.value + 100 });
          },
          onDestroy(s) {
            seenAtDestroy(s.count.value);
          },
        }),
      );

    const { Provider, useStore } = createStoreContext(factory);

    function Display(): ReactElement {
      const store = useStore();
      const count = useSignalValue(store.count);
      return (
        <button
          type="button"
          data-testid="row"
          onClick={() => {
            store.increment();
          }}
        >
          {count}
        </button>
      );
    }

    const { unmount } = render(
      <Provider initial={1}>
        <Display />
      </Provider>,
    );

    expect(screen.getByTestId('row').textContent).toBe('101');

    act(() => {
      screen.getByTestId('row').click();
    });
    expect(screen.getByTestId('row').textContent).toBe('102');

    unmount();

    expect(seenAtDestroy).toHaveBeenCalledTimes(1);
    expect(seenAtDestroy).toHaveBeenCalledWith(102);
  });
});
