import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { PlaybackStatus } from '../types/playback';
import type { Translations } from '../i18n';

interface UseSleepTimerOptions {
  statusRef: React.MutableRefObject<PlaybackStatus>;
  filePath: string;
  showMessage: (msg: string) => void;
  loc: Translations;
}

export function useSleepTimer({
  statusRef,
  filePath,
  showMessage,
  loc,
}: UseSleepTimerOptions) {
  const [sleepTimerRemainingSec, setSleepTimerRemainingSec] = useState<number | null>(null);
  const [sleepTimerTargetMode, setSleepTimerTargetMode] = useState<'end_of_track' | 'time' | null>(null);
  const [sleepTimerFadeOut, setSleepTimerFadeOut] = useState<boolean>(true);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);

  const preFadeVolumeRef = useRef<number | null>(null);
  const lastTrackUriRef = useRef<string | null>(null);

  const handleSetSleepTimer = useCallback((
    minutes: number | 'end_of_track',
    fadeOut: boolean
  ) => {
    setSleepTimerFadeOut(fadeOut);
    preFadeVolumeRef.current = null;

    if (minutes === 'end_of_track') {
      setSleepTimerTargetMode('end_of_track');
      setSleepTimerRemainingSec(null);
      lastTrackUriRef.current = statusRef.current.current_track?.uri || filePath;
      showMessage(loc.notifications.sleepTimerEndOfTrack);
    } else {
      setSleepTimerTargetMode('time');
      const totalSec = Math.max(1, Math.round(Number(minutes) * 60));
      setSleepTimerRemainingSec(totalSec);
      showMessage(loc.notifications.sleepTimerSet.replace('{0}', String(minutes)));
    }
  }, [filePath, loc.notifications.sleepTimerEndOfTrack, loc.notifications.sleepTimerSet, showMessage, statusRef]);

  const handleCancelSleepTimer = useCallback(() => {
    setSleepTimerRemainingSec(null);
    setSleepTimerTargetMode(null);
    if (preFadeVolumeRef.current !== null) {
      invoke('set_volume', { volume: preFadeVolumeRef.current }).catch(() => {});
      preFadeVolumeRef.current = null;
    }
    showMessage(loc.notifications.sleepTimerCancelled);
  }, [loc.notifications.sleepTimerCancelled, showMessage]);

  const hasActiveTimer = sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track';

  useEffect(() => {
    if (!hasActiveTimer) return;

    const interval = setInterval(async () => {
      const currentStatus = statusRef.current;

      if (sleepTimerTargetMode === 'end_of_track') {
        const currentUri = currentStatus.current_track?.uri || filePath;
        if (
          (lastTrackUriRef.current && currentUri && lastTrackUriRef.current !== currentUri) ||
          (currentStatus.duration_ms && currentStatus.duration_ms > 0 && currentStatus.position_ms >= currentStatus.duration_ms - 800)
        ) {
          await invoke('pause').catch(() => {});
          setSleepTimerTargetMode(null);
          showMessage(loc.notifications.sleepTimerTrackEnded);
        }
        return;
      }

      setSleepTimerRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          invoke('pause').catch(() => {});
          if (preFadeVolumeRef.current !== null) {
            invoke('set_volume', { volume: preFadeVolumeRef.current }).catch(() => {});
            preFadeVolumeRef.current = null;
          }
          setSleepTimerTargetMode(null);
          showMessage(loc.notifications.sleepTimerPaused);
          return null;
        }

        const nextSec = prev - 1;
        if (sleepTimerFadeOut && nextSec <= 30) {
          if (preFadeVolumeRef.current === null) {
            preFadeVolumeRef.current = currentStatus.volume;
          }
          const factor = Math.max(0.02, nextSec / 30);
          const fadeVol = (preFadeVolumeRef.current || 1.0) * factor;
          invoke('set_volume', { volume: fadeVol }).catch(() => {});
        }
        return nextSec;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [filePath, hasActiveTimer, loc.notifications.sleepTimerPaused, loc.notifications.sleepTimerTrackEnded, showMessage, sleepTimerFadeOut, sleepTimerTargetMode, statusRef]);

  return {
    sleepTimerRemainingSec,
    setSleepTimerRemainingSec,
    sleepTimerTargetMode,
    setSleepTimerTargetMode,
    sleepTimerFadeOut,
    setSleepTimerFadeOut,
    isSleepTimerOpen,
    setIsSleepTimerOpen,
    handleSetSleepTimer,
    handleCancelSleepTimer,
  };
}
