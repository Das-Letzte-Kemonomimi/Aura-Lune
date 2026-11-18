import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { PlaybackStatus } from '../types/playback';
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
  nowPlayingVisualMode: string;
  setNowPlayingVisualMode: (mode: any) => void;
  currentAlbum: AlbumRecord | null;
  initialStartupPositionRef: React.MutableRefObject<number | null>;
  showMessage: (msg: string, isError?: boolean) => void;
  loc: Translations;
}

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
      invoke('set_app_setting', {
        key: 'restore_session_on_startup',
        value: next ? 'true' : 'false',
      }).catch((e) => console.warn('Error saving restore_session_on_startup:', e));

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
    invoke<string | null>('get_app_setting', { key: 'restore_session_on_startup' })
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

      // 1. Volume, unit, visual mode
      if (typeof session.volume === 'number') {
        const vol = Math.max(0, Math.min(1.0, session.volume));
        setStatus((prev) => ({ ...prev, volume: vol }));
        invoke('set_volume', { volume: vol }).catch(() => {});
      }
      if (session.volume_unit === 'percent' || session.volume_unit === 'db') {
        setVolumeUnit(session.volume_unit);
      }
      if (session.nowplaying_visual_mode) {
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

  // Periodic debounced saving of current playback state
  const lastSavedSessionRef = useRef<string>('');
  useEffect(() => {
    if (!restoreSessionOnStartup) return;

    const currentTrack = currentPlayingTrack;
    const currentUri = status.current_track?.uri || filePath || currentTrack?.path || '';
    const currentPos = status.position_ms;
    const currentVol = status.volume ?? 1.0;

    const sessionPayload = {
      volume: currentVol,
      volume_unit: volumeUnit,
      track_id: status.current_track?.track_id || activeTrackId || currentTrack?.id || null,
      uri: currentUri,
      title: status.current_track?.title || currentTrack?.title || null,
      artist: status.current_track?.artist || currentTrack?.artist || null,
      album: status.current_track?.album || currentAlbum?.title || null,
      position_ms: currentPos,
      duration_ms: status.duration_ms || currentTrack?.duration_ms || null,
      pitch_semitones: status.pitch_semitones,
      tempo_ratio: status.tempo_ratio,
      rate_ratio: status.rate_ratio,
      engine: status.engine,
      equalizer_enabled: status.equalizer_enabled,
      equalizer_bands: status.equalizer_bands,
      nowplaying_visual_mode: nowPlayingVisualMode,
    };

    const serialized = JSON.stringify(sessionPayload);
    try {
      localStorage.setItem('auralune_playback_session', serialized);
    } catch {
      // ignore
    }

    const timer = setTimeout(() => {
      if (serialized !== lastSavedSessionRef.current) {
        lastSavedSessionRef.current = serialized;
        invoke('set_app_setting', {
          key: 'playback_session_state',
          value: serialized,
        }).catch(() => {});
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    activeTrackId,
    currentAlbum?.title,
    currentPlayingTrack,
    filePath,
    nowPlayingVisualMode,
    restoreSessionOnStartup,
    status.current_track?.album,
    status.current_track?.artist,
    status.current_track?.title,
    status.current_track?.track_id,
    status.current_track?.uri,
    status.duration_ms,
    status.engine,
    status.equalizer_bands,
    status.equalizer_enabled,
    status.pitch_semitones,
    status.position_ms,
    status.rate_ratio,
    status.tempo_ratio,
    status.volume,
    volumeUnit,
  ]);

  // Synchronous flush on window beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!restoreSessionOnStartup) return;
      const currentTrack = currentPlayingTrack;
      const currentUri = status.current_track?.uri || filePath || currentTrack?.path || '';
      const sessionPayload = {
        volume: status.volume ?? 1.0,
        volume_unit: volumeUnit,
        track_id: status.current_track?.track_id || activeTrackId || currentTrack?.id || null,
        uri: currentUri,
        title: status.current_track?.title || currentTrack?.title || null,
        artist: status.current_track?.artist || currentTrack?.artist || null,
        album: status.current_track?.album || currentAlbum?.title || null,
        position_ms: status.position_ms,
        duration_ms: status.duration_ms || currentTrack?.duration_ms || null,
        pitch_semitones: status.pitch_semitones,
        tempo_ratio: status.tempo_ratio,
        rate_ratio: status.rate_ratio,
        engine: status.engine,
        equalizer_enabled: status.equalizer_enabled,
        equalizer_bands: status.equalizer_bands,
        nowplaying_visual_mode: nowPlayingVisualMode,
      };
      try {
        localStorage.setItem('auralune_playback_session', JSON.stringify(sessionPayload));
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [
    activeTrackId,
    currentAlbum?.title,
    currentPlayingTrack,
    filePath,
    nowPlayingVisualMode,
    restoreSessionOnStartup,
    status.current_track?.album,
    status.current_track?.artist,
    status.current_track?.title,
    status.current_track?.track_id,
    status.current_track?.uri,
    status.duration_ms,
    status.engine,
    status.equalizer_bands,
    status.equalizer_enabled,
    status.pitch_semitones,
    status.position_ms,
    status.rate_ratio,
    status.tempo_ratio,
    status.volume,
    volumeUnit,
  ]);

  return {
    restoreSessionOnStartup,
    setRestoreSessionOnStartup,
    handleToggleRestoreSessionOnStartup,
  };
}
