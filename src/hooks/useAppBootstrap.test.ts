import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  BOOT_EXIT_DURATION_MS,
  BOOT_SAFETY_TIMEOUT_MS,
  useAppBootstrap,
  type UseAppBootstrapOptions,
} from './useAppBootstrap';
import { invokeMock } from '../test/ipcMock';


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

  it('calls reveal_main_window via double requestAnimationFrame on mount', async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });

    renderHook(() => useAppBootstrap(makeOptions()));

    // First rAF fires → enqueues second rAF
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);
    act(() => rafCallbacks[0]!(0));
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(2);
    // Second rAF fires → invoke('reveal_main_window')
    act(() => rafCallbacks[1]!(0));

    await act(async () => { await Promise.resolve(); });
    expect(invokeMock).toHaveBeenCalledWith('reveal_main_window');

    rafSpy.mockRestore();
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

  describe('bootState', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('reaches 100%, begins exit, and marks ready after all startup tasks settle', async () => {
      vi.useFakeTimers();

      let resolveLibrary!: () => void;
      const loadLibrary = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveLibrary = resolve;
          }),
      );

      const { result } = renderHook(() => useAppBootstrap(makeOptions({ loadLibrary })));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.bootState.isReady).toBe(false);
      expect(result.current.bootState.isExiting).toBe(false);
      expect(result.current.bootState.stage).toBe('library');
      expect(result.current.bootState.progress).toBe(80);

      await act(async () => {
        resolveLibrary();
        await Promise.resolve();
      });

      expect(result.current.bootState.progress).toBe(100);
      expect(result.current.bootState.stage).toBe('ready');
      expect(result.current.bootState.isExiting).toBe(true);
      expect(result.current.bootState.isReady).toBe(false);

      act(() => {
        vi.advanceTimersByTime(BOOT_EXIT_DURATION_MS);
      });

      expect(result.current.bootState.isReady).toBe(true);
    });

    it('still marks ready when a startup loader rejects', async () => {
      vi.useFakeTimers();

      const loadLibrary = vi.fn().mockRejectedValue(new Error('db busy'));
      const loadThemes = vi.fn().mockRejectedValue(new Error('theme fail'));
      const { result } = renderHook(() =>
        useAppBootstrap(makeOptions({ loadLibrary, loadThemes })),
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.bootState.isExiting).toBe(true);
      expect(result.current.bootState.progress).toBe(100);

      act(() => {
        vi.advanceTimersByTime(BOOT_EXIT_DURATION_MS);
      });

      expect(result.current.bootState.isReady).toBe(true);
    });

    it('reveals the UI via safety timeout if an initializer stalls', async () => {
      vi.useFakeTimers();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const stalledLibrary = vi.fn(() => new Promise<void>(() => {}));
      const { result } = renderHook(() =>
        useAppBootstrap(makeOptions({ loadLibrary: stalledLibrary })),
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.bootState.isReady).toBe(false);

      act(() => {
        vi.advanceTimersByTime(BOOT_SAFETY_TIMEOUT_MS);
      });

      expect(result.current.bootState.isExiting).toBe(true);
      expect(result.current.bootState.progress).toBe(100);

      act(() => {
        vi.advanceTimersByTime(BOOT_EXIT_DURATION_MS);
      });

      expect(result.current.bootState.isReady).toBe(true);
      warnSpy.mockRestore();
    });
  });
});
