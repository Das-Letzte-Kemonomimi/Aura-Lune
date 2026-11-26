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
} from '../ui/icons';
import { invoke } from '../../api/ipc';
import { listen } from '@tauri-apps/api/event';
import type { StemSeparationData, StemMixerState } from '../../types/analysis';
import { getTranslations, type Language } from '../../i18n';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

export interface StemMixerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId?: number;
  trackPath?: string;
  trackTitle?: string;
  embedded?: boolean;
  currentLang?: Language;
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
  trackTitle,
  embedded = false,
  currentLang = 'en',
}) => {
  const t = getTranslations(currentLang);
  const displayTrackTitle = trackTitle || t.stems.modalTrackDefault;
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

  // Listen for separation progress from Tauri events
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

  // Check whether stems already exist for the track
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
    setProgressMsg(t.stems.initSeparation);

    try {
      const res = await invoke<StemSeparationData>('start_stem_separation', {
        path: trackPath,
        trackId,
        modelId: 'htdemucs_v4',
      });
      setStems(res);
      setProgressVal(1.0);
      setProgressMsg(t.stems.separationSuccess);
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
      console.error('Failed to restore the original track:', err);
    }
  };

  const updateMixer = async (newMixer: StemMixerState) => {
    setMixerState(newMixer);
    try {
      await invoke('set_stem_mixer_state', { statePayload: newMixer });
    } catch (err) {
      console.error('Failed to update the mixer:', err);
    }
  };

  const toggleSolo = (stem: string) => {
    const newSolo = mixerState.solo_stem === stem ? undefined : stem;
    updateMixer({ ...mixerState, solo_stem: newSolo });
  };

  const toggleKaraoke = () => {
    updateMixer({ ...mixerState, karaoke_mode: !mixerState.karaoke_mode });
  };

  const stemList: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    volume: number;
    mute: boolean;
    setVolume: (val: number) => void;
    toggleMute: () => void;
  }> = [
      {
        id: 'vocals',
        label: t.stems.channelVocals,
        icon: <Mic size={16} />,
        color: '#ec4899',
        volume: mixerState.vocals_volume,
        mute: mixerState.vocals_mute || mixerState.karaoke_mode,
        setVolume: (v) => updateMixer({ ...mixerState, vocals_volume: v }),
        toggleMute: () => updateMixer({ ...mixerState, vocals_mute: !mixerState.vocals_mute }),
      },
      {
        id: 'drums',
        label: t.stems.channelDrums,
        icon: <Disc size={16} />,
        color: '#f59e0b',
        volume: mixerState.drums_volume,
        mute: mixerState.drums_mute,
        setVolume: (v) => updateMixer({ ...mixerState, drums_volume: v }),
        toggleMute: () => updateMixer({ ...mixerState, drums_mute: !mixerState.drums_mute }),
      },
      {
        id: 'bass',
        label: t.stems.channelBass,
        icon: <Radio size={16} />,
        color: '#06b6d4',
        volume: mixerState.bass_volume,
        mute: mixerState.bass_mute,
        setVolume: (v) => updateMixer({ ...mixerState, bass_volume: v }),
        toggleMute: () => updateMixer({ ...mixerState, bass_mute: !mixerState.bass_mute }),
      },
      {
        id: 'other',
        label: t.stems.channelOther,
        icon: <Sliders size={16} />,
        color: '#a855f7',
        volume: mixerState.other_volume,
        mute: mixerState.other_mute,
        setVolume: (v) => updateMixer({ ...mixerState, other_volume: v }),
        toggleMute: () => updateMixer({ ...mixerState, other_mute: !mixerState.other_mute }),
      },
    ];

  const content = (
    <div className="flex w-full flex-col gap-4">
      {/* Status and quick action bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4.5 py-3"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="rounded-3xl border border-accent-cyan/35 bg-accent-cyan/15 px-2.5 py-1 text-xs font-bold text-sky-400"
          >
            {t.stems.spectralSeparation}
          </span>
          {mixerState.enabled && (
            <span
              className="rounded-3xl border border-accent-green/40 bg-accent-green/20 px-2.5 py-1 text-xs font-bold text-emerald-400"
            >
              {t.stems.activeInAudioPath}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleKaraoke}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-ui font-bold text-fg transition-all duration-200',
              mixerState.karaoke_mode ? 'border-pink-500' : 'border-white/15',
              mixerState.karaoke_mode ? 'bg-pink-500' : 'bg-white/5',
              mixerState.karaoke_mode ? 'shadow-halo-md shadow-pink-500/40' : 'shadow-none',
            )}
          >
            <Mic size={14} />
            <span>{t.stems.karaokeMode}</span>
          </button>

          {!mixerState.enabled ? (
            <button
              onClick={handleLoadStemsToPlayer}
              disabled={!stems}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border border-accent-green/40 bg-accent-green/20 px-3.5 py-2 text-ui font-bold text-emerald-300',
                stems ? 'cursor-pointer' : 'cursor-not-allowed',
                stems ? 'opacity-100' : 'opacity-50',
              )}
            >
              <Play size={14} />
              <span>{t.stems.loadStemsBtn}</span>
            </button>
          ) : (
            <button
              onClick={handleRestoreOriginalTrack}
              className="flex items-center gap-1.5 rounded-xl border border-accent-cyan/40 bg-linear-135 from-accent-cyan/25 to-accent-purple/25 px-3.5 py-2 text-ui font-bold text-cyan-300 shadow-halo-md shadow-accent-cyan/30"
              title={t.stems.restoreOriginalTooltip}
            >
              <RotateCcw size={14} />
              <span>{t.stems.returnToTrackBtn}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-accent-red/30 bg-accent-red/15 px-4 py-3 text-ui text-red-300">
          {error}
        </div>
      )}

      {/* Stems not separated yet */}
      {!stems ? (
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/6 bg-white/2 px-6 py-12 text-center"
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full border border-accent-cyan/35 bg-linear-135 from-accent-cyan/20 to-pink-500/20 text-sky-400"
          >
            <Sliders size={32} />
          </div>

          <div className="max-w-120">
            <h3 className="mx-0 mt-0 mb-1.5 text-lg font-extrabold text-fg">
              {t.stems.separateStemsTitle}
            </h3>
            <p className="m-0 text-ui leading-normal text-fg-secondary">
              {t.stems.separationDesc}
            </p>
          </div>

          {loading ? (
            <div className="flex w-full max-w-90 flex-col gap-2">
              <div className="h-2 w-full overflow-hidden rounded-sm bg-white/10">
                <div
                  className="h-full bg-linear-to-r from-accent-cyan to-pink-500 transition-[width] duration-300"
                  style={{ width: `${Math.round(progressVal * 100)}%` }}
                />
              </div>
              <p className="m-0 font-mono text-ui text-slate-300">
                {progressMsg} ({(progressVal * 100).toFixed(0)}%)
              </p>
            </div>
          ) : (
            <button
              onClick={handleStartSeparation}
              className="flex items-center gap-2 rounded-xl border-0 bg-linear-135 from-accent-cyan to-pink-500 px-6 py-3 text-sm font-bold text-fg shadow-xl shadow-accent-cyan/35 transition-transform duration-150"
            >
              <Sparkles size={18} />
              <span>{t.stems.startSeparation}</span>
            </button>
          )}
        </div>
      ) : (
        /* Grid of 4 stems */
        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))] gap-3.5">
          {stemList.map((stem) => {
            const isSolo = mixerState.solo_stem === stem.id;
            return (
              <div
                key={stem.id}
                className={cn(
                  'flex flex-col gap-3 rounded-2xl border bg-white/3 p-4 transition-all duration-150',
                  isSolo ? 'border-accent-amber' : stem.mute ? 'border-accent-red/30' : 'border-white/8',
                )}
              >
                {/* Title and Solo/Mute buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center" style={{ color: stem.color }}>
                      {stem.icon}
                    </span>
                    <span className="text-sm font-bold text-fg">
                      {stem.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleSolo(stem.id)}
                      className={cn(
                        'rounded-md border px-2 py-1 text-xxs font-extrabold',
                        isSolo ? 'border-accent-amber' : 'border-white/10',
                        isSolo ? 'bg-accent-amber' : 'bg-white/5',
                        isSolo ? 'text-slate-900' : 'text-fg-secondary',
                      )}
                    >
                      SOLO
                    </button>
                    <button
                      onClick={stem.toggleMute}
                      className={cn(
                        'rounded-md border px-2 py-1 text-xxs font-extrabold',
                        stem.mute ? 'border-accent-red/50' : 'border-white/10',
                        stem.mute ? 'bg-accent-red/25' : 'bg-white/5',
                        stem.mute ? 'text-red-300' : 'text-fg-secondary',
                      )}
                    >
                      MUTE
                    </button>
                  </div>
                </div>

                {/* Volume slider and percentage */}
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={stem.volume}
                    onChange={(e) => stem.setVolume(parseFloat(e.target.value))}
                    className="h-1.5 flex-1 cursor-pointer"
                    style={{ accentColor: stem.color }}
                  />
                  <span
                    className={cn(
                      'w-10.5 text-right font-mono text-ui font-semibold',
                      stem.mute ? 'text-fg-muted' : 'text-fg',
                    )}
                  >
                    {Math.round(stem.volume * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="h-full w-full overflow-y-auto p-1">
        {content}
      </div>
    );
  }

  return (
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex max-w-180 flex-col overflow-hidden rounded-3xl border border-accent-cyan/35 p-6 text-fg"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9.5 w-9.5 items-center justify-center rounded-xl border border-accent-cyan/35 bg-accent-cyan/20 text-sky-400"
          >
            <Layers size={20} />
          </div>
          <div>
            <h2
              className="m-0 bg-linear-to-r bg-clip-text from-accent-cyan to-pink-500 text-lg font-extrabold text-transparent"
            >
              {t.stems.modalTitle}
            </h2>
            <p className="mx-0 mt-0.5 mb-0 text-xs text-fg-secondary">{displayTrackTitle}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-fg-secondary"
        >
          <X size={18} />
        </button>
      </div>

      {content}
    </ModalShell>
  );
};
