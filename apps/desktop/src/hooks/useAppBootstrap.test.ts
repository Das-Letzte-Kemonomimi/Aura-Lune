import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppBootstrap } from './useAppBootstrap';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: vi.fn().mockResolvedValue(vi.fn()),
  }),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onDragDropEvent: vi.fn().mockResolvedValue(vi.fn()),
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

describe('useAppBootstrap', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
  });

  it('runs initial data and service loaders on mount', async () => {
    const refreshDevices = vi.fn();
    const loadLibrary = vi.fn();
    const loadPresets = vi.fn();
    const loadThemes = vi.fn();
    const refreshQueue = vi.fn();
    const refreshPlaylists = vi.fn();
    const setAppVersion = vi.fn();

    renderHook(() =>
      useAppBootstrap({
        refreshDevices,
        loadLibrary,
        loadPresets,
        loadThemes,
        refreshQueue,
        refreshPlaylists,
        setAppVersion,
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
      })
    );

    expect(refreshDevices).toHaveBeenCalled();
    expect(loadLibrary).toHaveBeenCalled();
    expect(loadPresets).toHaveBeenCalled();
    expect(loadThemes).toHaveBeenCalled();
    expect(refreshQueue).toHaveBeenCalled();
    expect(refreshPlaylists).toHaveBeenCalled();
  });

  it('manages isDraggingOver state', () => {
    const { result } = renderHook(() =>
      useAppBootstrap({
        refreshDevices: vi.fn(),
        loadLibrary: vi.fn(),
        loadPresets: vi.fn(),
        loadThemes: vi.fn(),
        refreshQueue: vi.fn(),
        refreshPlaylists: vi.fn(),
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
      })
    );

    expect(result.current.isDraggingOver).toBe(false);
    act(() => {
      result.current.setIsDraggingOver(true);
    });
    expect(result.current.isDraggingOver).toBe(true);
  });
});
