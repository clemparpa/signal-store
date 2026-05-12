import { patchState, signalStore, withComputed, withMethods, withState } from '@fluch/signal-store';
import { computed, type ReadonlySignal, type Signal } from '@preact/signals-core';
import { act, render, screen } from '@testing-library/react';
import { type ReactElement, useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { createStoreContext } from './create-store-context';

function useSignalValue<T>(sig: Signal<T> | ReadonlySignal<T>): T {
  const [value, setValue] = useState<T>(sig.peek());
  useEffect(() => sig.subscribe(setValue), [sig]);
  return value;
}

type Todo = { id: string; title: string; done: boolean };

const makeTodoStore = (props: { initial?: Todo[] } = {}) =>
  signalStore(
    withState({
      todos: props.initial ?? ([] as Todo[]),
      filter: 'all' as 'all' | 'pending' | 'done',
    }),
    withComputed(({ todos, filter }) => ({
      visible: computed(() => {
        const f = filter.value;
        const all = todos.value;
        if (f === 'pending') return all.filter((t) => !t.done);
        if (f === 'done') return all.filter((t) => t.done);
        return all;
      }),
    })),
    withMethods((store) => ({
      add: (t: Todo) => patchState(store, (s) => ({ todos: [...s.todos, t] })),
      toggle: (id: string) =>
        patchState(store, (s) => ({
          todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),
      setFilter: (f: 'all' | 'pending' | 'done') => patchState(store, { filter: f }),
    })),
  );

describe('createStoreContext — realistic integration', () => {
  it('drives a todo flow end-to-end through Provider + useStore', () => {
    const { Provider, useStore } = createStoreContext(makeTodoStore);

    function Counter(): ReactElement {
      const store = useStore();
      const visible = useSignalValue(store.visible);
      return <span data-testid="count">{visible.length}</span>;
    }

    function Controls(): ReactElement {
      const store = useStore();
      return (
        <>
          <button
            type="button"
            data-testid="add"
            onClick={() => store.add({ id: 'a', title: 'first', done: false })}
          >
            add
          </button>
          <button type="button" data-testid="done-filter" onClick={() => store.setFilter('done')}>
            done
          </button>
        </>
      );
    }

    render(
      <Provider initial={[{ id: 'seed', title: 'seed', done: true }]}>
        <Counter />
        <Controls />
      </Provider>,
    );

    expect(screen.getByTestId('count').textContent).toBe('1');

    act(() => {
      screen.getByTestId('add').click();
    });
    expect(screen.getByTestId('count').textContent).toBe('2');

    act(() => {
      screen.getByTestId('done-filter').click();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('keeps two sibling Providers fully isolated', () => {
    const ctx = createStoreContext(makeTodoStore);

    function Counter({ id }: { id: string }): ReactElement {
      const store = ctx.useStore();
      const todos = useSignalValue(store.todos);
      return <span data-testid={`count-${id}`}>{todos.length}</span>;
    }

    function Add({ id }: { id: string }): ReactElement {
      const store = ctx.useStore();
      return (
        <button
          type="button"
          data-testid={`add-${id}`}
          onClick={() => store.add({ id, title: id, done: false })}
        >
          add
        </button>
      );
    }

    render(
      <>
        <ctx.Provider>
          <Counter id="a" />
          <Add id="a" />
        </ctx.Provider>
        <ctx.Provider>
          <Counter id="b" />
          <Add id="b" />
        </ctx.Provider>
      </>,
    );

    expect(screen.getByTestId('count-a').textContent).toBe('0');
    expect(screen.getByTestId('count-b').textContent).toBe('0');

    act(() => {
      screen.getByTestId('add-a').click();
    });
    expect(screen.getByTestId('count-a').textContent).toBe('1');
    expect(screen.getByTestId('count-b').textContent).toBe('0');
  });
});
