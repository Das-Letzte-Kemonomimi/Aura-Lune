import { useState, useCallback } from 'react';
import type { AmbienceMode } from '../components/player/AnimeAmbienceFX';
import type { Translations } from '../i18n';
import { soundscapeEngine } from '../utils/soundscapeAudio';

export interface UseAmbienceModeOptions {
  loc: Translations;
  showMessage: (msg: string, isError?: boolean) => void;
}

export function useAmbienceMode({ loc, showMessage }: UseAmbienceModeOptions) {
  const [ambienceMode, setAmbienceMode] = useState<AmbienceMode>(() => {
    try {
      const saved = localStorage.getItem('auralune_ambience_mode');
      if (
        saved === 'sakura' ||
        saved === 'neon_rain' ||
        saved === 'fireflies' ||
        saved === 'snow' ||
        saved === 'meteor_shower' ||
        saved === 'matrix_rain' ||
        saved === 'momiji' ||
        saved === 'embers' ||
        saved === 'off'
      ) {
        return saved as AmbienceMode;
      }
    } catch (_) { }
    return 'off';
  });

  const cycleAmbienceMode = useCallback(() => {
    setAmbienceMode((prev: AmbienceMode) => {
      const next: AmbienceMode =
        prev === 'off'
          ? 'sakura'
          : prev === 'sakura'
            ? 'neon_rain'
            : prev === 'neon_rain'
              ? 'fireflies'
              : prev === 'fireflies'
                ? 'snow'
                : prev === 'snow'
                  ? 'meteor_shower'
                  : prev === 'meteor_shower'
                    ? 'matrix_rain'
                    : prev === 'matrix_rain'
                      ? 'momiji'
                      : prev === 'momiji'
                        ? 'embers'
                        : 'off';
      try {
        localStorage.setItem('auralune_ambience_mode', next);
      } catch (_) { }

      const notif = loc.notifications;
      showMessage(
        next === 'sakura'
          ? notif.ambienceSakura
          : next === 'neon_rain'
            ? notif.ambienceNeon
            : next === 'fireflies'
              ? notif.ambienceFireflies
              : next === 'snow'
                ? notif.ambienceSnow
                : next === 'meteor_shower'
                  ? notif.ambienceMeteor
                  : next === 'matrix_rain'
                    ? notif.ambienceMatrix
                    : next === 'momiji'
                      ? notif.ambienceMomiji
                      : next === 'embers'
                        ? notif.ambienceGothicEmbers
                        : notif.ambienceOff
      );
      try {
        soundscapeEngine.syncWithVisualAmbience(next);
      } catch (_) { }
      return next;
    });
  }, [loc.notifications, showMessage]);

  return {
    ambienceMode,
    setAmbienceMode,
    cycleAmbienceMode,
  };
}
