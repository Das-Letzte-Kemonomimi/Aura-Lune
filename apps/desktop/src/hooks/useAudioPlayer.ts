import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { PlaybackStatus, DspEngineType, AudioCard } from '../types/player';
import { DEFAULT_PLAYBACK_STATUS } from '../types/player';

export interface UseAudioPlayerProps {
  onNotify?: (message: string, isError?: boolean) => void;
  onTrackEnded?: () => void;
}

export function useAudioPlayer({ onNotify, onTrackEnded }: UseAudioPlayerProps = {}) {
  const [status, setStatus] = useState<PlaybackStatus>(DEFAULT_PLAYBACK_STATUS);
  const [filePath, setFilePath] = useState<string>('');
  const [cards, setCards] = useState<AudioCard[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const previousVolumeRef = useRef<number>(1.0);

  const notify = useCallback(
    (msg: string, isError = false) => {
      if (onNotify) {
        onNotify(msg, isError);
      }
    },
    [onNotify]
  );

  const seekProgressPercent =
    status.duration_ms && status.duration_ms > 0
      ? Math.min(100, Math.max(0, (status.position_ms / status.duration_ms) * 100))
      : 0;

  const volumeProgressPercent = Math.min(100, Math.max(0, (status.volume ?? 1) * 100));

  const pollStatus = useCallback(async () => {
    try {
      const res = await invoke<PlaybackStatus>('get_playback_status');
      setStatus((prev) => {
        // Detect end of stream transition
        if (prev.state === 'Playing' && res.state === 'Stopped' && prev.position_ms > 0) {
          if (onTrackEnded) {
            onTrackEnded();
          }
        }
        return res;
      });
      return res;
    } catch {
      // Backend may be momentarily busy during seek or state switch
      return null;
    }
  }, [onTrackEnded]);

  const play = useCallback(async () => {
    try {
      setStatus((prev) => ({ ...prev, state: 'Playing' }));
      await invoke('play');
      await pollStatus();
    } catch (e: unknown) {
      notify(`Błąd odtwarzania: ${e}`, true);
    }
  }, [pollStatus, notify]);

  const pause = useCallback(async () => {
    try {
      setStatus((prev) => ({ ...prev, state: 'Paused' }));
      await invoke('pause');
      await pollStatus();
    } catch (e: unknown) {
      notify(`Błąd pauzy: ${e}`, true);
    }
  }, [pollStatus, notify]);

  const stop = useCallback(async () => {
    try {
      setStatus((prev) => ({ ...prev, state: 'Stopped', position_ms: 0 }));
      await invoke('stop');
      await pollStatus();
    } catch (e: unknown) {
      notify(`Błąd zatrzymania: ${e}`, true);
    }
  }, [pollStatus, notify]);

  const togglePlay = useCallback(async () => {
    if (status.state === 'Playing') {
      await pause();
    } else {
      await play();
    }
  }, [status.state, pause, play]);

  const seek = useCallback(
    async (positionMs: number) => {
      if (positionMs < 0) return;
      try {
        setStatus((prev) => ({ ...prev, position_ms: positionMs }));
        await invoke('seek', { positionMs });
      } catch (e: unknown) {
        notify(`Błąd przewijania: ${e}`, true);
      }
    },
    [notify]
  );

  const setVolume = useCallback(
    async (newVolume: number) => {
      const clamped = Math.max(0, Math.min(2.0, newVolume));
      try {
        setStatus((prev) => ({ ...prev, volume: clamped }));
        if (clamped > 0) {
          setIsMuted(false);
          previousVolumeRef.current = clamped;
        } else {
          setIsMuted(true);
        }
        await invoke('set_volume', { volume: clamped });
      } catch (e: unknown) {
        notify(`Błąd głośności: ${e}`, true);
      }
    },
    [notify]
  );

  const toggleMute = useCallback(async () => {
    if (isMuted) {
      const restored = previousVolumeRef.current > 0 ? previousVolumeRef.current : 1.0;
      await setVolume(restored);
      setIsMuted(false);
    } else {
      previousVolumeRef.current = status.volume;
      await setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, status.volume, setVolume]);

  const setPitch = useCallback(
    async (pitchSemitones: number) => {
      const clamped = Math.max(-24, Math.min(24, pitchSemitones));
      try {
        setStatus((prev) => ({ ...prev, pitch_semitones: clamped }));
        await invoke('set_pitch_semitones', { pitchSemitones: clamped });
      } catch (e: unknown) {
        notify(`Błąd tonacji: ${e}`, true);
      }
    },
    [notify]
  );

  const setTempo = useCallback(
    async (tempoRatio: number) => {
      const clamped = Math.max(0.15, Math.min(4.0, tempoRatio));
      try {
        setStatus((prev) => ({ ...prev, tempo_ratio: clamped }));
        await invoke('set_tempo_ratio', { tempoRatio: clamped });
      } catch (e: unknown) {
        notify(`Błąd tempa: ${e}`, true);
      }
    },
    [notify]
  );

  const setRate = useCallback(
    async (rateRatio: number) => {
      const clamped = Math.max(0.25, Math.min(3.0, rateRatio));
      try {
        setStatus((prev) => ({ ...prev, rate_ratio: clamped }));
        await invoke('set_rate_ratio', { rateRatio: clamped });
      } catch (e: unknown) {
        notify(`Błąd prędkości: ${e}`, true);
      }
    },
    [notify]
  );

  const setDspEngine = useCallback(
    async (engine: DspEngineType) => {
      try {
        setStatus((prev) => ({ ...prev, engine }));
        await invoke('set_dsp_engine', { engine });
        await pollStatus();
        notify(`Silnik DSP zmieniony na ${engine}`);
      } catch (e: unknown) {
        notify(`Błąd zmiany silnika DSP: ${e}`, true);
      }
    },
    [pollStatus, notify]
  );

  const refreshDevices = useCallback(async () => {
    try {
      const list = await invoke<AudioCard[]>('list_devices');
      setCards(list);
      return list;
    } catch (e: unknown) {
      console.warn('Błąd odpytywania kart audio:', e);
      return [];
    }
  }, []);

  return {
    status,
    setStatus,
    filePath,
    setFilePath,
    cards,
    setCards,
    isMuted,
    seekProgressPercent,
    volumeProgressPercent,
    pollStatus,
    play,
    pause,
    stop,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    setPitch,
    setTempo,
    setRate,
    setDspEngine,
    refreshDevices,
  };
}
