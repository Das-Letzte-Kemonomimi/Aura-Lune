import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { invokeMock } from '../test/ipcMock';
import { useMiniPlayer } from './useMiniPlayer';

describe('useMiniPlayer', () => {
  it('toggles mini-player mode through IPC', async () => {
    invokeMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useMiniPlayer());
    expect(result.current.isMiniPlayer).toBe(false);

    await act(async () => {
      await result.current.toggleMiniPlayer();
    });
    expect(invokeMock).toHaveBeenCalledWith('set_mini_player_mode', { mini: true });
    expect(result.current.isMiniPlayer).toBe(true);
  });

  it('keeps state unchanged when IPC fails', async () => {
    invokeMock.mockRejectedValueOnce(new Error('window error'));
    const { result } = renderHook(() => useMiniPlayer());

    await act(async () => {
      await result.current.toggleMiniPlayer();
    });
    expect(result.current.isMiniPlayer).toBe(false);
  });
});
