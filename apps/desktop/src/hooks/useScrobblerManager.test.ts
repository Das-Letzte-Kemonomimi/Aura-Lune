import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrobblerManager } from './useScrobblerManager';
import { getTranslations } from '../i18n';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

describe('useScrobblerManager hook', () => {
  const loc = getTranslations('en');
  const showMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default discord and scrobbler states', () => {
    const { result } = renderHook(() =>
      useScrobblerManager({ isSettingsOpen: false, showMessage, loc })
    );

    expect(result.current.discordRpcEnabled).toBe(true);
    expect(result.current.discordRpcConnected).toBe(false);
    expect(result.current.listenbrainzEnabled).toBe(false);
    expect(result.current.lastfmEnabled).toBe(false);
  });

  it('toggles discord rpc state and calls invoke', async () => {
    const { result } = renderHook(() =>
      useScrobblerManager({ isSettingsOpen: false, showMessage, loc })
    );

    await act(async () => {
      await result.current.handleToggleDiscordRpc(false);
    });

    expect(result.current.discordRpcEnabled).toBe(false);
    expect(showMessage).toHaveBeenCalled();
  });

  it('toggles lastfm enabled state and calls invoke', async () => {
    const { result } = renderHook(() =>
      useScrobblerManager({ isSettingsOpen: false, showMessage, loc })
    );

    await act(async () => {
      await result.current.handleToggleLastfm(true);
    });

    expect(result.current.lastfmEnabled).toBe(true);
    expect(showMessage).toHaveBeenCalled();
  });
});
