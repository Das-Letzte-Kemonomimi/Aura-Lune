import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppBootstrap, type UseAppBootstrapOptions } from './useAppBootstrap';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

type DragDropHandler = (event: { payload: { type: string; paths?: string[] } }) => void;
type EventHandler = (event: { payload: { paths?: string[] } }) => void;

const dragHandlers = vi.hoisted(() => ({
  webview: null as DragDropHandler | null,
  window: null as DragDropHandler | null,
  events: new Map<string, EventHandler>(),
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: vi.fn((handler: DragDropHandler) => {
      dragHandlers.webview = handler;
      return Promise.resolve(vi.fn());
    }),
  }),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onDragDropEvent: vi.fn((handler: DragDropHandler) => {
      dragHandlers.window = handler;
      return Promise.resolve(vi.fn());
    }),
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name: string, handler: EventHandler) => {
    dragHandlers.events.set(name, handler);
    return Promise.resolve(vi.fn());
  }),
}));

function makeOptions(overrides: Partial<UseAppBootstrapOptions> = {}): UseAppBootstrapOptions {
  return {
    refreshDevices: vi.fn(),
    loadLibrary: vi.fn(),
    loadThemes: vi.fn(),
    refreshQueue: vi.fn(),
    setAppVersion: vi.fn(),
    setLanguage: vi.fn(),
    setSeekFadeEnabled: vi.fn(),
    setCloseToTray: vi.fn(),
    setCrossfadeDuration: vi.fn(),
    setBassBoost: vi.fn(),
    setStereoWidenerActive: vi.fn(),
    setStereoWidenerAmount: vi.fn(),
    setLimiterEnabled: vi.fn(),
    setEqAutoStartup: vi.fn(),
    handleDropPaths: vi.fn().mockResolvedValue(undefined),
    stereoWidenerActive: false,
    stereoWidenerAmount: 0.15,
    ...overrides,
  };
}

describe('useAppBootstrap', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
    dragHandlers.webview = null;
    dragHandlers.window = null;
    dragHandlers.events.clear();
  });

  it('runs initial data and service loaders on mount', () => {
    const options = makeOptions();
    renderHook(() => useAppBootstrap(options));

    expect(options.refreshDevices).toHaveBeenCalled();
    expect(options.loadLibrary).toHaveBeenCalled();
    expect(options.loadThemes).toHaveBeenCalled();
    expect(options.refreshQueue).toHaveBeenCalled();
  });

  it('manages isDraggingOver state', () => {
    const { result } = renderHook(() => useAppBootstrap(makeOptions()));

    expect(result.current.isDraggingOver).toBe(false);
    act(() => {
      result.current.setIsDraggingOver(true);
    });
    expect(result.current.isDraggingOver).toBe(true);
  });

  it('handles one physical drop only once even when every channel reports it', async () => {
    const handleDropPaths = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAppBootstrap(makeOptions({ handleDropPaths })));
    await act(async () => {});

    const paths = ['/music/a.flac', '/music/b.flac'];
    act(() => {
      dragHandlers.webview?.({ payload: { type: 'drop', paths } });
      dragHandlers.window?.({ payload: { type: 'drop', paths } });
      dragHandlers.events.get('tauri://drag-drop')?.({ payload: { paths: [...paths].reverse() } });
    });

    expect(handleDropPaths).toHaveBeenCalledTimes(1);
    expect(handleDropPaths).toHaveBeenCalledWith(paths);
  });

  it('accepts a different drop right after the previous one', async () => {
    const handleDropPaths = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAppBootstrap(makeOptions({ handleDropPaths })));
    await act(async () => {});

    act(() => {
      dragHandlers.webview?.({ payload: { type: 'drop', paths: ['/music/a.flac'] } });
      dragHandlers.webview?.({ payload: { type: 'drop', paths: ['/music/c.flac'] } });
    });

    expect(handleDropPaths).toHaveBeenCalledTimes(2);
  });

  it('uses the latest handleDropPaths after a re-render', async () => {
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ handler }) => useAppBootstrap(makeOptions({ handleDropPaths: handler })), {
      initialProps: { handler: first },
    });
    await act(async () => {});
    rerender({ handler: second });

    act(() => {
      dragHandlers.webview?.({ payload: { type: 'drop', paths: ['/music/x.flac'] } });
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(['/music/x.flac']);
  });
});
