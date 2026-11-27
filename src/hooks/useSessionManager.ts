import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { invoke } from '../api/ipc';
import { getSetting, setSetting } from '../api/settings';
import { currentPositionMs } from '../state/livePlayback';
import type { PlaybackStatus } from '../types/playback';
import { isNowPlayingVisualMode, type NowPlayingVisualMode } from '../types/navigation';
import type { TrackRecord, AlbumRecord } from '../types/library';
import type { Translations } from '../i18n';

export interface UseSessionManagerOptions {
  status: PlaybackStatus;
  setStatus: React.Dispatch<React.SetStateAction<PlaybackStatus>>;
  filePath: string;
  setFilePath: (path: string) => void;
  currentPlayingTrack: TrackRecord | null;
  activeTrackId: number | null;
  setActiveTrackId: (id: number | null) => void;
  volumeUnit: 'percent' | 'db';
  setVolumeUnit: (unit: 'percent' | 'db') => void;
  nowPlayingVisualMode: NowPlayingVisualMode;
  setNowPlayingVisualMode: (mode: NowPlayingVisualMode) => void;
  currentAlbum: AlbumRecord | null;
  initialStartupPositionRef: React.MutableRefObject<number | null>;
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
}

const SESSION_SAVE_THROTTLE_MS = 5_000;

export function useSessionManager({
  status,
  setStatus,
  filePath,
  setFilePath,
  currentPlayingTrack,
  activeTrackId,
  setActiveTrackId,
  volumeUnit,
  setVolumeUnit,
  nowPlayingVisualMode,
  setNowPlayingVisualMode,
  currentAlbum,
  initialStartupPositionRef,
  showMessage,
  loc,
}: UseSessionManagerOptions) {
  const [restoreSessionOnStartup, setRestoreSessionOnStartup] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('auralune_restore_session_on_startup');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const handleToggleRestoreSessionOnStartup = useCallback(async () => {
    setRestoreSessionOnStartup((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('auralune_restore_session_on_startup', String(next));
      } catch {
        // ignore
      }
      setSetting('restore_session_on_startup', next ? 'true' : 'false').catch((e) => console.warn('Error saving restore_session_on_startup:', e));

      showMessage(
        next
          ? loc.notifications.restoreSessionMsgOn
          : loc.notifications.restoreSessionMsgOff
      );
      return next;
    });
  }, [loc.notifications.restoreSessionMsgOff, loc.notifications.restoreSessionMsgOn, showMessage]);

  // Restore session on initial mount
  useEffect(() => {
    getSetting('restore_session_on_startup')
      .then((val) => {
        if (val !== null) {
          setRestoreSessionOnStartup(val !== 'false');
        }
      })
      .catch((e) => console.warn('Error reading restore_session_on_startup:', e));

    const shouldRestore = localStorage.getItem('auralune_restore_session_on_startup') !== 'false';
    if (!shouldRestore) return;

    const savedLocal = localStorage.getItem('auralune_playback_session');
    if (!savedLocal) return;

    try {
      const session = JSON.parse(savedLocal);
      if (!session) return;

      // 1. Volume unit, visual mode (volume itself is restored by the backend from `playback_volume`)
      if (session.volume_unit === 'percent' || session.volume_unit === 'db') {
        setVolumeUnit(session.volume_unit);
      }
      if (isNowPlayingVisualMode(session.nowplaying_visual_mode)) {
        setNowPlayingVisualMode(session.nowplaying_visual_mode);
      }

      // 2. DSP & EQ parameters
      if (session.engine && session.engine !== 'Bypass') {
        invoke('set_dsp_params', {
          engine: session.engine,
          pitchSemitones: session.pitch_semitones ?? 0.0,
          tempoRatio: session.tempo_ratio ?? 1.0,
          rateRatio: session.rate_ratio ?? 1.0,
        }).catch(() => {});
      }
      if (session.equalizer_enabled && session.equalizer_bands) {
        invoke('set_equalizer_params', {
          enabled: true,
          bands: session.equalizer_bands,
        }).catch(() => {});
      }

      // 3. Track & position
      const trackUri = session.uri || '';
      const trackId = session.track_id ?? null;

      if (trackId) {
        setActiveTrackId(trackId);
      }
      if (trackUri) {
        setFilePath(trackUri);
      }

      if (trackUri || trackId) {
        const savedPos = session.position_ms || 0;
        if (savedPos > 1000) {
          initialStartupPositionRef.current = savedPos;
        }
        setStatus((prev) => ({
          ...prev,
          position_ms: savedPos,
          duration_ms: session.duration_ms || prev.duration_ms,
          engine: session.engine || prev.engine,
          pitch_semitones: session.pitch_semitones ?? prev.pitch_semitones,
          tempo_ratio: session.tempo_ratio ?? prev.tempo_ratio,
          rate_ratio: session.rate_ratio ?? prev.rate_ratio,
          current_track: {
            id: trackId ? `restored-track-${trackId}` : `restored-uri-${Date.now()}`,
            uri: trackUri,
            track_id: trackId,
            title: session.title || '',
            artist: session.artist || '',
            album: session.album || null,
            duration_ms: session.duration_ms || 0,
          },
        }));
      }
    } catch (err) {
      console.warn('Error restoring session:', err);
    }
  }, [initialStartupPositionRef, setActiveTrackId, setFilePath, setNowPlayingVisualMode, setStatus, setVolumeUnit]);

  // Throttled persistence of playback state (at most every 5 s while playing, immediate on transitions)
  const lastSavedSessionRef = useRef<string>('');
  const lastWriteAtRef = useRef<number>(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreSessionRef = useRef(restoreSessionOnStartup);
  const latestArgsRef = useRef({
    status,
    filePath,
    currentPlayingTrack,
    activeTrackId,
    volumeUnit,
    nowPlayingVisualMode,
    currentAlbum,
  });

  useLayoutEffect(() => {
    restoreSessionRef.current = restoreSessionOnStartup;
    latestArgsRef.current = {
      status,
      filePath,
      currentPlayingTrack,
      activeTrackId,
      volumeUnit,
      nowPlayingVisualMode,
      currentAlbum,
    };
  });

  const buildSerializedSession = useCallback(() => {
    const {
      status: s,
      filePath: fp,
      currentPlayingTrack: curTrack,
      activeTrackId: trackId,
      volumeUnit: volUnit,
      nowPlayingVisualMode: visualMode,
      currentAlbum: album,
    } = latestArgsRef.current;

    const currentUri = s.current_track?.uri || fp || curTrack?.path || '';
    const currentPos = currentPositionMs(s.position_ms);
    const currentVol = s.volume ?? 1.0;

    return JSON.stringify({
      volume: currentVol,
      volume_unit: volUnit,
      track_id: s.current_track?.track_id || trackId || curTrack?.id || null,
      uri: currentUri,
      title: s.current_track?.title || curTrack?.title || null,
      artist: s.current_track?.artist || curTrack?.artist || null,
      album: s.current_track?.album || album?.title || null,
      position_ms: currentPos,
      duration_ms: s.duration_ms || curTrack?.duration_ms || null,
      pitch_semitones: s.pitch_semitones,
      tempo_ratio: s.tempo_ratio,
      rate_ratio: s.rate_ratio,
      engine: s.engine,
      equalizer_enabled: s.equalizer_enabled,
      equalizer_bands: s.equalizer_bands,
      nowplaying_visual_mode: visualMode,
    });
  }, []);

  const writeSessionNow = useCallback(() => {
    if (!restoreSessionRef.current) return;
    if (trailingTimerRef.current !== null) {
      clearTimeout(trailingTimerRef.current);
      trailingTimerRef.current = null;
    }
    const serialized = buildSerializedSession();
    if (serialized === lastSavedSessionRef.current) return;
    lastSavedSessionRef.current = serialized;
    lastWriteAtRef.current = Date.now();
    try {
      localStorage.setItem('auralune_playback_session', serialized);
    } catch {
      // ignore
    }
    setSetting('playback_session_state', serialized).catch(() => {});
  }, [buildSerializedSession]);

  const trackKey = `${activeTrackId ?? ''}|${status.current_track?.track_id ?? ''}|${
    status.current_track?.uri || filePath || currentPlayingTrack?.path || ''
  }`;
  const prevTrackKeyRef = useRef<string | null>(null);
  const prevStateRef = useRef<PlaybackStatus['state'] | null>(null);

  useEffect(() => {
    const prevTrackKey = prevTrackKeyRef.current;
    const prevState = prevStateRef.current;
    prevTrackKeyRef.current = trackKey;
    prevStateRef.current = status.state;

    if (!restoreSessionOnStartup) return;

    const trackChanged = prevTrackKey !== null && prevTrackKey !== trackKey;
    const pausedOrStopped =
      prevState === 'Playing' && (status.state === 'Paused' || status.state === 'Stopped');

    if (trackChanged || pausedOrStopped) {
      writeSessionNow();
      return;
    }

    if (prevTrackKey === null) {
      lastWriteAtRef.current = Date.now();
      return;
    }

    const elapsed = Date.now() - lastWriteAtRef.current;
    if (elapsed >= SESSION_SAVE_THROTTLE_MS) {
      writeSessionNow();
      return;
    }

    if (trailingTimerRef.current === null) {
      trailingTimerRef.current = setTimeout(() => {
        trailingTimerRef.current = null;
        writeSessionNow();
      }, SESSION_SAVE_THROTTLE_MS - elapsed);
    }
  }, [
    restoreSessionOnStartup,
    trackKey,
    status.state,
    status.volume,
    volumeUnit,
    status.current_track?.title,
    status.current_track?.artist,
    status.current_track?.album,
    status.duration_ms,
    currentPlayingTrack?.title,
    currentPlayingTrack?.artist,
    currentPlayingTrack?.duration_ms,
    currentAlbum?.title,
    status.pitch_semitones,
    status.tempo_ratio,
    status.rate_ratio,
    status.engine,
    status.equalizer_enabled,
    status.equalizer_bands,
    nowPlayingVisualMode,
    writeSessionNow,
  ]);

  // Periodic save at most every 5 s during continuous playback
  useEffect(() => {
    if (!restoreSessionOnStartup || status.state !== 'Playing') return;
    const timer = window.setInterval(() => {
      writeSessionNow();
    }, SESSION_SAVE_THROTTLE_MS);
    return () => window.clearInterval(timer);
  }, [restoreSessionOnStartup, status.state, writeSessionNow]);

  // Flush on pagehide, tab hidden, and window beforeunload
  useEffect(() => {
    const handleFlush = () => {
      writeSessionNow();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        writeSessionNow();
      }
    };

    window.addEventListener('beforeunload', handleFlush);
    window.addEventListener('pagehide', handleFlush);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      window.removeEventListener('pagehide', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (trailingTimerRef.current !== null) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }
    };
  }, [writeSessionNow]);

  return {
    restoreSessionOnStartup,
    setRestoreSessionOnStartup,
    handleToggleRestoreSessionOnStartup,
  };
}
