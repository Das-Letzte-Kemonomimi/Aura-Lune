import React, { useState, useEffect } from 'react';
import {
  Layers,
  Mic,
  Disc,
  Radio,
  Sliders,
  Sparkles,
  X,
  Play,
  RotateCcw,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { StemSeparationData, StemMixerState } from '../types/analysis';

interface StemMixerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId?: number;
  trackPath?: string;
  trackTitle?: string;
}

interface StemProgressPayload {
  track_id: number;
  progress: number;
  message: string;
}

export const StemMixerModal: React.FC<StemMixerModalProps> = ({
  isOpen,
  onClose,
  trackId,
  trackPath,
  trackTitle = 'Utwór',
}) => {
  const [stems, setStems] = useState<StemSeparationData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressVal, setProgressVal] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const [mixerState, setMixerState] = useState<StemMixerState>({
    enabled: false,
    vocals_volume: 1.0,
    drums_volume: 1.0,
    bass_volume: 1.0,
    other_volume: 1.0,
    piano_volume: 1.0,
    guitar_volume: 1.0,
    vocals_mute: false,
    drums_mute: false,
    bass_mute: false,
    other_mute: false,
    piano_mute: false,
    guitar_mute: false,
    solo_stem: undefined,
    karaoke_mode: false,
  });

  // Nasłuchiwanie postępu separacji ze zdarzeń Tauri
  useEffect(() => {
    const unlistenPromise = listen<StemProgressPayload>('auralune://stem-progress', (event) => {
      if (trackId && event.payload.track_id === trackId) {
        setProgressVal(event.payload.progress);
        setProgressMsg(event.payload.message);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [trackId]);

  // Sprawdzenie czy stemy dla utworu już istnieją
  useEffect(() => {
    if (!isOpen || !trackId) return;

    let isMounted = true;
    const fetchStems = async () => {
      setError(null);
      try {
        const cached = await invoke<StemSeparationData | null>('get_track_stems', { trackId });
        if (cached && isMounted) {
          setStems(cached);
        }

        const curMixer = await invoke<StemMixerState>('get_stem_mixer_state');
        if (curMixer && isMounted) {
          setMixerState(curMixer);
        }
      } catch (err) {
        if (isMounted) setError(String(err));
      }
    };

    fetchStems();
    return () => {
      isMounted = false;
    };
  }, [isOpen, trackId]);

  if (!isOpen) return null;

  const handleStartSeparation = async () => {
    if (!trackId || !trackPath) return;
    setLoading(true);
    setError(null);
    setProgressVal(0.05);
    setProgressMsg('Inicjalizacja separacji...');

    try {
      const res = await invoke<StemSeparationData>('start_stem_separation', {
        path: trackPath,
        trackId,
        modelId: 'htdemucs_v4',
      });
      setStems(res);
      setProgressVal(1.0);
      setProgressMsg('Separacja zakończona sukcesem!');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadStemsToPlayer = async () => {
    if (!trackId) return;
    try {
      const loaded = await invoke<StemMixerState>('load_track_stems', { trackId });
      setMixerState(loaded);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleRestoreOriginalTrack = async () => {
    try {
      await invoke('restore_original_track');
      setMixerState((prev) => ({ ...prev, enabled: false }));
    } catch (err) {
      console.error('Błąd przywracania oryginalnego utworu:', err);
    }
  };

  const updateMixer = async (newMixer: StemMixerState) => {
    setMixerState(newMixer);
    try {
      await invoke('set_stem_mixer_state', { statePayload: newMixer });
    } catch (err) {
      console.error('Błąd aktualizacji miksera:', err);
    }
  };

  const toggleSolo = (stem: string) => {
    const newSolo = mixerState.solo_stem === stem ? undefined : stem;
    updateMixer({ ...mixerState, solo_stem: newSolo });
  };

  const toggleKaraoke = () => {
    updateMixer({ ...mixerState, karaoke_mode: !mixerState.karaoke_mode });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900/95 border border-slate-700/60 rounded-2xl p-6 max-w-2xl w-full flex flex-col shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
                Mikser Stemów (Separacja Ścieżek)
              </h2>
              <p className="text-xs text-slate-400">{trackTitle}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {mixerState.enabled && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/30">
                AKTYWNY W TORZE AUDIO
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-xs">
            {error}
          </div>
        )}

        {/* Jeśli stemy nie są jeszcze rozdzielone */}
        {!stems ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
            <div className="p-4 rounded-full bg-slate-800/80 border border-slate-700">
              <Sliders className="w-10 h-10 text-cyan-400" />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-200 mb-1">
                Rozdziel utwór na niezależne instrumenty
              </h3>
              <p className="text-xs text-slate-400">
                Wydobądź wokal, perkusję, bas oraz pozostałe instrumenty. Możesz wyciszać dowolne ścieżki (np. Karaoke) lub słuchać ich w trybie solo z pełną obsługą zmiany tempa i tonacji.
              </p>
            </div>

            {loading ? (
              <div className="w-full max-w-sm space-y-2">
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-pink-500 h-2 transition-all duration-300"
                    style={{ width: `${Math.round(progressVal * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-300 font-mono">
                  {progressMsg} ({(progressVal * 100).toFixed(0)}%)
                </p>
              </div>
            ) : (
              <button
                onClick={handleStartSeparation}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Rozpocznij separację ścieżek</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pasek szybkiego karaoke i ładowania */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700">
              <button
                onClick={toggleKaraoke}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                  mixerState.karaoke_mode
                    ? 'bg-pink-500 text-white border-pink-400 shadow-md shadow-pink-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Tryb Karaoke (Wycisz wokal)</span>
              </button>

              {!mixerState.enabled ? (
                <button
                  onClick={handleLoadStemsToPlayer}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 text-xs font-medium transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Włącz stemy w odtwarzaczu</span>
                </button>
              ) : (
                <button
                  onClick={handleRestoreOriginalTrack}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Wróć do oryginalnego utworu</span>
                </button>
              )}
            </div>

            {/* Suwaki 4 stemów */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Vocals */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Mic className="w-4 h-4 text-pink-400" />
                    <span className="text-xs font-bold text-slate-200">Wokal (Vocals)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => toggleSolo('vocals')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                        mixerState.solo_stem === 'vocals'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      SOLO
                    </button>
                    <button
                      onClick={() =>
                        updateMixer({ ...mixerState, vocals_mute: !mixerState.vocals_mute })
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                        mixerState.vocals_mute || mixerState.karaoke_mode
                          ? 'bg-red-500/30 text-red-300 border-red-500/50'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      MUTE
                    </button>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={mixerState.vocals_volume}
                    onChange={(e) =>
                      updateMixer({ ...mixerState, vocals_volume: parseFloat(e.target.value) })
                    }
                    className="flex-1 accent-pink-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-400 w-10 text-right">
                    {Math.round(mixerState.vocals_volume * 100)}%
                  </span>
                </div>
              </div>

              {/* Drums */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Disc className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-bold text-slate-200">Perkusja (Drums)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => toggleSolo('drums')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                        mixerState.solo_stem === 'drums'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      SOLO
                    </button>
                    <button
                      onClick={() =>
                        updateMixer({ ...mixerState, drums_mute: !mixerState.drums_mute })
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                        mixerState.drums_mute
                          ? 'bg-red-500/30 text-red-300 border-red-500/50'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      MUTE
                    </button>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={mixerState.drums_volume}
                    onChange={(e) =>
                      updateMixer({ ...mixerState, drums_volume: parseFloat(e.target.value) })
                    }
                    className="flex-1 accent-yellow-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-400 w-10 text-right">
                    {Math.round(mixerState.drums_volume * 100)}%
                  </span>
                </div>
              </div>

              {/* Bass */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-slate-200">Bas (Bass)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => toggleSolo('bass')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                        mixerState.solo_stem === 'bass'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      SOLO
                    </button>
                    <button
                      onClick={() =>
                        updateMixer({ ...mixerState, bass_mute: !mixerState.bass_mute })
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                        mixerState.bass_mute
                          ? 'bg-red-500/30 text-red-300 border-red-500/50'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      MUTE
                    </button>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={mixerState.bass_volume}
                    onChange={(e) =>
                      updateMixer({ ...mixerState, bass_volume: parseFloat(e.target.value) })
                    }
                    className="flex-1 accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-400 w-10 text-right">
                    {Math.round(mixerState.bass_volume * 100)}%
                  </span>
                </div>
              </div>

              {/* Other */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-200">Pozostałe (Other)</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => toggleSolo('other')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                        mixerState.solo_stem === 'other'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      SOLO
                    </button>
                    <button
                      onClick={() =>
                        updateMixer({ ...mixerState, other_mute: !mixerState.other_mute })
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                        mixerState.other_mute
                          ? 'bg-red-500/30 text-red-300 border-red-500/50'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      MUTE
                    </button>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={mixerState.other_volume}
                    onChange={(e) =>
                      updateMixer({ ...mixerState, other_volume: parseFloat(e.target.value) })
                    }
                    className="flex-1 accent-purple-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-400 w-10 text-right">
                    {Math.round(mixerState.other_volume * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

