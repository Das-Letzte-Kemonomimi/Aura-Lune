import { useCallback, useState } from 'react';
import { invoke } from '../api/ipc';

/** Manages the floating mini-player window mode via Tauri IPC. */
export function useMiniPlayer() {
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);

  const toggleMiniPlayer = useCallback(async () => {
    const next = !isMiniPlayer;
    try {
      await invoke('set_mini_player_mode', { mini: next });
      setIsMiniPlayer(next);
    } catch (e: unknown) {
      console.error('Failed to toggle the mini-player mode:', e);
    }
  }, [isMiniPlayer]);

  return { isMiniPlayer, setIsMiniPlayer, toggleMiniPlayer };
}
