import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '../api/ipc';
import type { PlaybackStatus } from '../types/playback';
import type { Translations } from '../i18n';
import { fmt } from '../utils/fmt';
import { silenceVolumeOsdFor } from '../state/volumeOsdSilence';

interface UseSleepTimerOptions {
  statusRef: React.MutableRefObject<PlaybackStatus>;
  filePath: string;
  showMessage: (msg: string) => void;
  loc: Translations;
}

/** Sets the volume for the sleep-timer fade or its restore, without the volume OSD popping up. */
function setVolumeSilently(volume: number): Promise<unknown> {
  silenceVolumeOsdFor(volume);
  return invoke('set_volume', { volume });
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
      showMessage(fmt(loc.notifications.sleepTimerSet, String(minutes)));
    }
  }, [filePath, loc.notifications.sleepTimerEndOfTrack, loc.notifications.sleepTimerSet, showMessage, statusRef]);

  const handleCancelSleepTimer = useCallback(() => {
    setSleepTimerRemainingSec(null);
    setSleepTimerTargetMode(null);
    if (preFadeVolumeRef.current !== null) {
      setVolumeSilently(preFadeVolumeRef.current).catch(() => {});
      preFadeVolumeRef.current = null;
    }
    showMessage(loc.notifications.sleepTimerCancelled);
  }, [loc.notifications.sleepTimerCancelled, showMessage]);

  const hasActiveTimer = sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track';

  // The latest values for the interval. The interval must not depend on them directly:
  // `showMessage`/`filePath` changed on renders (10×/s during playback),
  // which restarted the interval before it could count down even one second.
  const remainingRef = useRef(sleepTimerRemainingSec);
  const latestRef = useRef({ filePath, showMessage, loc, sleepTimerFadeOut });
  useEffect(() => {
    remainingRef.current = sleepTimerRemainingSec;
  }, [sleepTimerRemainingSec]);
  useEffect(() => {
    latestRef.current = { filePath, showMessage, loc, sleepTimerFadeOut };
  }, [filePath, showMessage, loc, sleepTimerFadeOut]);

  useEffect(() => {
    if (!hasActiveTimer) return;

    const restorePreFadeVolume = () => {
      if (preFadeVolumeRef.current !== null) {
        setVolumeSilently(preFadeVolumeRef.current).catch(() => {});
        preFadeVolumeRef.current = null;
      }
    };

    const interval = setInterval(() => {
      const currentStatus = statusRef.current;
      const latest = latestRef.current;

      if (sleepTimerTargetMode === 'end_of_track') {
        const currentUri = currentStatus.current_track?.uri || latest.filePath;
        const trackChanged =
          !!lastTrackUriRef.current && !!currentUri && lastTrackUriRef.current !== currentUri;
        const nearEnd =
          !!currentStatus.duration_ms &&
          currentStatus.duration_ms > 0 &&
          currentStatus.position_ms >= currentStatus.duration_ms - 800;
        if (trackChanged || nearEnd) {
          invoke('pause').catch(() => {});
          setSleepTimerTargetMode(null);
          latest.showMessage(latest.loc.notifications.sleepTimerTrackEnded);
        }
        return;
      }

      const prev = remainingRef.current;
      if (prev === null) return;

      if (prev <= 1) {
        remainingRef.current = null;
        invoke('pause').catch(() => {});
        restorePreFadeVolume();
        setSleepTimerRemainingSec(null);
        setSleepTimerTargetMode(null);
        latest.showMessage(latest.loc.notifications.sleepTimerPaused);
        return;
      }

      const nextSec = prev - 1;
      remainingRef.current = nextSec;
      setSleepTimerRemainingSec(nextSec);

      if (latest.sleepTimerFadeOut && nextSec <= 30) {
        if (preFadeVolumeRef.current === null) {
          preFadeVolumeRef.current = currentStatus.volume;
        }
        const factor = Math.max(0.02, nextSec / 30);
        const fadeVol = (preFadeVolumeRef.current || 1.0) * factor;
        setVolumeSilently(fadeVol).catch(() => {});
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [hasActiveTimer, sleepTimerTargetMode, statusRef]);

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
