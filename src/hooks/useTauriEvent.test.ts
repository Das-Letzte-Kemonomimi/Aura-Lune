import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTauriEvent } from './useTauriEvent';

type Listener = (event: { payload: unknown }) => void;

const listenState = vi.hoisted(() => ({
  listeners: new Map<string, Listener>(),
  resolvers: [] as Array<() => void>,
  unlistenSpies: [] as Array<ReturnType<typeof vi.fn>>,
  deferred: false,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name: string, cb: Listener) => {
    listenState.listeners.set(name, cb);
    const unlisten = vi.fn(() => listenState.listeners.delete(name));
    listenState.unlistenSpies.push(unlisten);
    if (!listenState.deferred) return Promise.resolve(unlisten);
    return new Promise((resolve) => {
      listenState.resolvers.push(() => resolve(unlisten));
    });
  }),
}));

function emit(name: string, payload: unknown) {
  listenState.listeners.get(name)?.({ payload });
}

describe('useTauriEvent', () => {
  beforeEach(() => {
    listenState.listeners.clear();
    listenState.resolvers = [];
    listenState.unlistenSpies = [];
    listenState.deferred = false;
  });

  it('delivers payloads to the handler', async () => {
    const handler = vi.fn();
    renderHook(() => useTauriEvent<number>('progress', handler));
    await act(async () => {});

    emit('progress', 42);
    expect(handler).toHaveBeenCalledWith(42);
  });

  it('calls the latest handler without re-subscribing', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ h }) => useTauriEvent('progress', h), {
      initialProps: { h: first },
    });
    await act(async () => {});
    rerender({ h: second });

    emit('progress', 1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(1);
    expect(listenState.unlistenSpies).toHaveLength(1);
  });

  it('unsubscribes when unmounted before listen() resolves', async () => {
    listenState.deferred = true;
    const handler = vi.fn();
    const { unmount } = renderHook(() => useTauriEvent('progress', handler));

    unmount();
    await act(async () => {
      listenState.resolvers.forEach((resolve) => resolve());
    });

    expect(listenState.unlistenSpies[0]).toHaveBeenCalledTimes(1);
    emit('progress', 1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not subscribe while disabled', async () => {
    renderHook(() => useTauriEvent('progress', vi.fn(), false));
    await act(async () => {});
    expect(listenState.listeners.size).toBe(0);
  });
});
