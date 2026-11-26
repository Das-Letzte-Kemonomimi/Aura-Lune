import React, { useEffect, useId, useState } from 'react';
import { Layers, Mic, Disc, Radio, Sliders, Sparkles, Play, RotateCcw } from '../ui/icons';
import { errorMessage, invoke } from '../../api/ipc';
import type { StemSeparationData, StemMixerState } from '../../types/analysis';
import { getTranslations, type Language } from '../../i18n';
import { useTauriEvent } from '../../hooks/useTauriEvent';
import { cn } from '../../utils/cn';
import { fmt } from '../../utils/fmt';
import {
  Badge,
  Button,
  Callout,
  Card,
  Chip,
  ModalBody,
  ModalHeader,
  ModalShell,
  ProgressBar,
  RangeSlider,
  type Tone,
} from '../ui';
import { iconTileTones, textTones } from '../ui/tones';

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
  const titleId = useId();
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

  // Separation progress for this track
  useTauriEvent<StemProgressPayload>('auralune://stem-progress', (payload) => {
    if (trackId && payload.track_id === trackId) {
      setProgressVal(payload.progress);
      setProgressMsg(payload.message);
    }
  });

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
      } catch (err: unknown) {
        if (isMounted) setError(errorMessage(err));
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
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadStemsToPlayer = async () => {
    if (!trackId) return;
    try {
      const loaded = await invoke<StemMixerState>('load_track_stems', { trackId });
      setMixerState(loaded);
    } catch (err: unknown) {
      setError(errorMessage(err));
    }
  };

  const handleRestoreOriginalTrack = async () => {
    try {
      await invoke('restore_original_track');
      setMixerState((prev) => ({ ...prev, enabled: false }));
    } catch (err: unknown) {
      console.error('Failed to restore the original track:', err);
    }
  };

  const updateMixer = async (newMixer: StemMixerState) => {
    setMixerState(newMixer);
    try {
      await invoke('set_stem_mixer_state', { statePayload: newMixer });
    } catch (err: unknown) {
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
    tone: Tone;
    volume: number;
    mute: boolean;
    setVolume: (val: number) => void;
    toggleMute: () => void;
  }> = [
    {
      id: 'vocals',
      label: t.stems.channelVocals,
      icon: <Mic size={16} />,
      tone: 'pink',
      volume: mixerState.vocals_volume,
      mute: mixerState.vocals_mute || mixerState.karaoke_mode,
      setVolume: (v) => updateMixer({ ...mixerState, vocals_volume: v }),
      toggleMute: () => updateMixer({ ...mixerState, vocals_mute: !mixerState.vocals_mute }),
    },
    {
      id: 'drums',
      label: t.stems.channelDrums,
      icon: <Disc size={16} />,
      tone: 'amber',
      volume: mixerState.drums_volume,
      mute: mixerState.drums_mute,
      setVolume: (v) => updateMixer({ ...mixerState, drums_volume: v }),
      toggleMute: () => updateMixer({ ...mixerState, drums_mute: !mixerState.drums_mute }),
    },
    {
      id: 'bass',
      label: t.stems.channelBass,
      icon: <Radio size={16} />,
      tone: 'cyan',
      volume: mixerState.bass_volume,
      mute: mixerState.bass_mute,
      setVolume: (v) => updateMixer({ ...mixerState, bass_volume: v }),
      toggleMute: () => updateMixer({ ...mixerState, bass_mute: !mixerState.bass_mute }),
    },
    {
      id: 'other',
      label: t.stems.channelOther,
      icon: <Sliders size={16} />,
      tone: 'purple',
      volume: mixerState.other_volume,
      mute: mixerState.other_mute,
      setVolume: (v) => updateMixer({ ...mixerState, other_volume: v }),
      toggleMute: () => updateMixer({ ...mixerState, other_mute: !mixerState.other_mute }),
    },
  ];

  const content = (
    <div className="flex w-full flex-col gap-4">
      {/* Status and quick actions */}
      <Card padding="none" className="flex flex-wrap items-center justify-between gap-3 px-4.5 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge tone="cyan">{t.stems.spectralSeparation}</Badge>
          {mixerState.enabled && <Badge tone="green">{t.stems.activeInAudioPath}</Badge>}
        </div>

        <div className="flex items-center gap-2.5">
          <Chip pressed={mixerState.karaoke_mode} onClick={toggleKaraoke} className="px-3.5 py-2">
            <Mic size={14} />
            {t.stems.karaokeMode}
          </Chip>

          {!mixerState.enabled ? (
            <Button variant="tinted" tone="green" onClick={handleLoadStemsToPlayer} disabled={!stems}>
              <Play size={14} />
              {t.stems.loadStemsBtn}
            </Button>
          ) : (
            <Button variant="tinted" tone="cyan" onClick={handleRestoreOriginalTrack} title={t.stems.restoreOriginalTooltip}>
              <RotateCcw size={14} />
              {t.stems.returnToTrackBtn}
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <Callout tone="danger" role="alert" className="text-ui text-fg">
          {error}
        </Callout>
      )}

      {!stems ? (
        /* No stems yet: offer the separation */
        <Card padding="none" className="flex flex-col items-center justify-center gap-4 rounded-3xl px-6 py-12 text-center">
          <div className={cn('flex size-16 items-center justify-center rounded-full', iconTileTones.cyan)}>
            <Sliders size={32} />
          </div>
          <div className="max-w-120">
            <h3 className="mx-0 mt-0 mb-1.5 text-lg font-extrabold text-fg">{t.stems.separateStemsTitle}</h3>
            <p className="m-0 text-ui leading-normal text-fg-secondary">{t.stems.separationDesc}</p>
          </div>

          {loading ? (
            <div className="flex w-full max-w-90 flex-col gap-2">
              <ProgressBar value={progressVal * 100} label={t.stems.separateStemsTitle} />
              <p className="m-0 font-mono text-ui text-fg-secondary">
                {progressMsg} ({(progressVal * 100).toFixed(0)}%)
              </p>
            </div>
          ) : (
            <Button variant="primary" size="lg" onClick={handleStartSeparation}>
              <Sparkles size={18} />
              {t.stems.startSeparation}
            </Button>
          )}
        </Card>
      ) : (
        /* The four stems */
        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))] gap-3.5">
          {stemList.map((stem) => {
            const isSolo = mixerState.solo_stem === stem.id;
            return (
              <Card
                key={stem.id}
                padding="sm"
                highlight={isSolo ? 'amber' : stem.mute && 'red'}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('flex items-center', textTones[stem.tone])}>{stem.icon}</span>
                    <span className="text-sm font-bold text-fg">{stem.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Chip size="xs" tone="amber" pressed={isSolo} onClick={() => toggleSolo(stem.id)} className="font-extrabold">
                      SOLO
                    </Chip>
                    <Chip size="xs" tone="red" pressed={stem.mute} onClick={stem.toggleMute} className="font-extrabold">
                      MUTE
                    </Chip>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <RangeSlider
                    aria-label={fmt(t.stems.faderLabel, stem.label)}
                    min={0}
                    max={2}
                    step={0.05}
                    value={stem.volume}
                    onChange={stem.setVolume}
                    className="flex-1"
                  />
                  <span className={cn('w-10.5 text-right font-mono text-ui font-semibold', stem.mute ? 'text-fg-muted' : 'text-fg')}>
                    {Math.round(stem.volume * 100)}%
                  </span>
                </div>
              </Card>
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
    <ModalShell onClose={onClose} layer="studio" size="lg" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={t.stems.modalTitle}
        subtitle={displayTrackTitle}
        icon={<Layers size={20} />}
        tone="cyan"
        onClose={onClose}
        closeLabel={t.common.close}
      />
      <ModalBody>{content}</ModalBody>
    </ModalShell>
  );
};
