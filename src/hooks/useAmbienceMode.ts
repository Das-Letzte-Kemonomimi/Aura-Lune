import { useCallback } from 'react';
import { AMBIENCE_MODES, type AmbienceMode } from '../components/player/ambienceModes';
import type { Translations } from '../i18n';
import { soundscapeEngine } from '../utils/soundscapeAudio';
import { parseOneOf, usePersistedState } from './usePersistedState';

export interface UseAmbienceModeOptions {
  loc: Translations;
  showMessage: (msg: string, isError?: boolean) => void;
}

/** The toast shown after switching to each mode. */
const AMBIENCE_MESSAGE_KEYS: Record<AmbienceMode, keyof Translations['notifications']> = {
  off: 'ambienceOff',
  sakura: 'ambienceSakura',
  neon_rain: 'ambienceNeon',
  fireflies: 'ambienceFireflies',
  snow: 'ambienceSnow',
  meteor_shower: 'ambienceMeteor',
  matrix_rain: 'ambienceMatrix',
  momiji: 'ambienceMomiji',
  embers: 'ambienceGothicEmbers',
};

function nextAmbienceMode(mode: AmbienceMode): AmbienceMode {
  return AMBIENCE_MODES[(AMBIENCE_MODES.indexOf(mode) + 1) % AMBIENCE_MODES.length];
}

export function useAmbienceMode({ loc, showMessage }: UseAmbienceModeOptions) {
  // Persisted by the hook itself: callers must not write the key again.
  const [ambienceMode, setAmbienceMode] = usePersistedState<AmbienceMode>('auralune_ambience_mode', 'off', {
    parse: parseOneOf(AMBIENCE_MODES),
  });

  const cycleAmbienceMode = useCallback(() => {
    const next = nextAmbienceMode(ambienceMode);
    setAmbienceMode(next);
    showMessage(loc.notifications[AMBIENCE_MESSAGE_KEYS[next]]);
    try {
      soundscapeEngine.syncWithVisualAmbience(next);
    } catch {}
  }, [ambienceMode, setAmbienceMode, loc.notifications, showMessage]);

  return {
    ambienceMode,
    setAmbienceMode,
    cycleAmbienceMode,
  };
}
