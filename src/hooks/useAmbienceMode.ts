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

export const AMBIENCE_OPACITY_KEY = 'auralune_ambience_opacity';
export const AMBIENCE_OPACITY_DEFAULT = 0.55;
export const AMBIENCE_OPACITY_MIN = 0.1;

/** Strength of the ambience particles, 0.1 to 1. Persisted; every mounted user of the hook stays in sync. */
export function useAmbienceOpacity() {
  return usePersistedState<number>(AMBIENCE_OPACITY_KEY, AMBIENCE_OPACITY_DEFAULT, {
    parse: (raw) => {
      const value = Number(raw);
      return Number.isFinite(value) ? Math.min(1, Math.max(AMBIENCE_OPACITY_MIN, value)) : undefined;
    },
  });
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
