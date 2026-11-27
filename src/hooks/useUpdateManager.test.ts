import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUpdateManager } from './useUpdateManager';
import { invokeMock } from '../test/ipcMock';
import type { BuildInfo, UpdateInfo } from '../types/updates';

type Listener = (event: { payload: unknown }) => void;
const listeners = vi.hoisted(() => new Map<string, Listener>());

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name: string, cb: Listener) => {
    listeners.set(name, cb);
    return Promise.resolve(() => listeners.delete(name));
  }),
}));

const build: BuildInfo = {
  version: '1.1.6-dev',
  commit: 'a'.repeat(40),
  commit_short: 'aaaaaaa',
  channel: 'dev',
  install_kind: 'app_image_managed',
};

function updateInfo(overrides: Partial<UpdateInfo> = {}): UpdateInfo {
  return {
    available: true,
    channel: 'dev',
    current_version: '1.1.6-dev',
    current_commit: build.commit,
    latest_version: 'dev-bbbbbbb',
    latest_commit: 'b'.repeat(40),
    release_url: 'https://github.com/x/y/releases/tag/dev-build',
    release_notes: null,
    asset: null,
    install_kind: 'app_image_managed',
    can_install: true,
    checked_at: 1000,
    ...overrides,
  };
}

function mockBackend(settings: Record<string, string | null> = {}) {
  invokeMock.mockImplementation(async (cmd: string, args?: { key?: string }) => {
    if (cmd === 'get_build_info') return build;
    if (cmd === 'get_cached_update_info') return null;
    if (cmd === 'get_app_setting') return settings[args?.key ?? ''] ?? null;
    return undefined;
  });
}

describe('useUpdateManager', () => {
  beforeEach(() => {
    listeners.clear();
  });

  it('loads build info and shows the badge when the backend announces an update', async () => {
    mockBackend();
    const { result } = renderHook(() => useUpdateManager());
    await waitFor(() => expect(result.current.buildInfo).toEqual(build));
    expect(result.current.hasUpdate).toBe(false);

    await waitFor(() => expect(listeners.has('auralune://update-available')).toBe(true));
    act(() => listeners.get('auralune://update-available')!({ payload: updateInfo() }));
    expect(result.current.info?.latest_version).toBe('dev-bbbbbbb');
    expect(result.current.hasUpdate).toBe(true);
  });

  it('hides the badge for a skipped version and stores the choice', async () => {
    mockBackend({ update_skipped_version: 'dev-bbbbbbb' });
    const { result } = renderHook(() => useUpdateManager());
    await waitFor(() => expect(listeners.has('auralune://update-available')).toBe(true));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('get_app_setting', { key: 'update_skipped_version' }));
    act(() => listeners.get('auralune://update-available')!({ payload: updateInfo() }));
    await waitFor(() => expect(result.current.isSkipped).toBe(true));
    expect(result.current.hasUpdate).toBe(false);

    act(() => listeners.get('auralune://update-available')!({ payload: updateInfo({ latest_version: 'dev-ccccccc' }) }));
    expect(result.current.hasUpdate).toBe(true);

    await act(() => result.current.skip());
    expect(invokeMock).toHaveBeenCalledWith('set_app_setting', {
      key: 'update_skipped_version',
      value: 'dev-ccccccc',
    });
    expect(result.current.hasUpdate).toBe(false);
  });

  it('checkNow forces a check and reports errors', async () => {
    mockBackend();
    const { result } = renderHook(() => useUpdateManager());
    await waitFor(() => expect(result.current.buildInfo).not.toBeNull());

    invokeMock.mockImplementationOnce(async () => updateInfo({ available: false }));
    await act(() => result.current.checkNow());
    expect(invokeMock).toHaveBeenCalledWith('check_for_update', { force: true });
    expect(result.current.info?.available).toBe(false);
    expect(result.current.error).toBeNull();

    invokeMock.mockRejectedValueOnce(new Error('offline'));
    await act(() => result.current.checkNow());
    expect(result.current.error).toContain('offline');
  });

  it('install marks the update as installed and keeps the badge until restart', async () => {
    mockBackend();
    const { result } = renderHook(() => useUpdateManager());
    await waitFor(() => expect(result.current.buildInfo).not.toBeNull());

    await act(() => result.current.install());
    expect(invokeMock).toHaveBeenCalledWith('install_update');
    expect(result.current.installed).toBe(true);
    expect(result.current.hasUpdate).toBe(true);

    await act(() => result.current.restart());
    expect(invokeMock).toHaveBeenCalledWith('restart_after_update');
  });

  it('persists the automatic check toggle', async () => {
    mockBackend({ update_check_enabled: 'false' });
    const { result } = renderHook(() => useUpdateManager());
    await waitFor(() => expect(result.current.autoCheckEnabled).toBe(false));
    await act(() => result.current.setAutoCheck(true));
    expect(invokeMock).toHaveBeenCalledWith('set_app_setting', { key: 'update_check_enabled', value: 'true' });
    expect(result.current.autoCheckEnabled).toBe(true);
  });
});
