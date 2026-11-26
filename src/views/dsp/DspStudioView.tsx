import React from 'react';
import { Activity, Power, RotateCcw, Save, Sliders } from '../../components/ui/icons';
import { SpectrumVisualizer } from '../../components/player/SpectrumVisualizer';
import { type EqualizerPreset } from '../../types/equalizer';
import type { DspPresetRecord, PlaybackStatus } from '../../types/player';
import { type Language, getTranslations } from '../../i18n';
import { useLiveStatus } from '../../state/livePlayback';
import { DspGraphicEqRack } from './sections/DspGraphicEqRack';
import { DspMasteringRack } from './sections/DspMasteringRack';
import { DspPresetManager } from './sections/DspPresetManager';
import { DspReverbPanel } from './sections/DspReverbPanel';
import { DspRateSlider } from './sections/DspRateSlider';
import { DspTempoSlider } from './sections/DspTempoSlider';
import { DspPitchSlider } from './sections/DspPitchSlider';
import { DspEngineSelector } from './sections/DspEngineSelector';
import { cn } from '../../utils/cn';
import { Badge, Button, Card, Chip, PageHeader, SectionHeader } from '../../components/ui';

export interface DspCombinationInfo {
  pitchSt: number;
  tempoRatio: number;
  rateRatio: number;
  rateSemitones: number;
  totalPitchSemitones: number;
  totalSpeedRatio: number;
  totalKey: { camelot: string; keyName: string; centsOffset: number } | null;
  totalBpm: number | null;
  hasPitch: boolean;
  hasTempo: boolean;
  hasRate: boolean;
  isCombined: boolean;
  engine: string;
}

export interface DspStudioViewProps {
  uiScale: number;
  loc: ReturnType<typeof getTranslations>;
  language: Language;
  currentLang?: Language;
  status: PlaybackStatus;
  activeTrackKeyBpm?: { key?: string | null; bpm?: number | null; camelot?: string | null } | null;
  dspAutoStartup: boolean;
  dspDefaultEngine: "Bypass" | "RubberBand" | "SoundTouch";
  dspBlockSize: number;
  dspCombination: DspCombinationInfo;
  bassBoost: number;
  lastBassBoostRef?: React.MutableRefObject<number>;
  stereoWidenerActive: boolean;
  stereoWidenerAmount: number;
  limiterEnabled: boolean;
  crossfeedEnabled: boolean;
  crossfeedPreset: "Default" | "ChuMoy" | "JanMeier" | "Custom";
  crossfeedFcut: number;
  crossfeedFeed: number;
  reverbEnabled: boolean;
  reverbRoomSize: number;
  reverbDamping: number;
  reverbWidth: number;
  reverbLevel: number;
  presets: DspPresetRecord[];
  eqAutoStartup: boolean;
  selectedEqPreset: string;
  eqPresets: EqualizerPreset[];
  newPresetName: string;
  setNewPresetName: (name: string) => void;

  handleToggleDspAutoStartup: () => void | Promise<void>;
  handleSaveDspStartupDefault: () => void | Promise<void>;
  handleResetDsp: () => void | Promise<void>;
  handleEngineChange: (engine: "Bypass" | "RubberBand" | "SoundTouch") => void | Promise<void>;
  handleSetDspBlockSize: (size: number) => void | Promise<void>;
  handlePitchChange: (semitones: number) => void;
  handleTempoChange: (tempoRatio: number) => void;
  handleRateChange: (rateRatio: number) => void;
  handleBassBoostChange: (boostDb: number) => void | Promise<void>;
  handleToggleStereoWidener: (active: boolean) => void | Promise<void>;
  handleStereoWidenerAmountChange: (amount: number) => void | Promise<void>;
  handleToggleLimiter: (enabled: boolean) => void | Promise<void>;
  handleSetCrossfeed: (
    enabled: boolean,
    preset: "Default" | "ChuMoy" | "JanMeier" | "Custom",
    fcut?: number,
    feed?: number
  ) => void | Promise<void>;
  handleUpdateReverb: (
    enabled: boolean,
    roomSize?: number,
    damping?: number,
    width?: number,
    level?: number
  ) => void | Promise<void>;
  handleLoadPreset: (preset: DspPresetRecord) => void | Promise<void>;
  handleSavePreset: () => void | Promise<void>;
  handleApplySignatureProfile: (profileId: string) => void | Promise<void>;
  handleToggleEqAutoStartup: () => void | Promise<void>;
  handleApplyEqPreset: (presetId: string) => void | Promise<void>;
  handleResetEq: () => void | Promise<void>;
  handleEqToggle: () => void | Promise<void>;
  handleEqBandChange: (bandIndex: number, gainDb: number) => void | Promise<void>;
  /** Always-on preamp (dB, ±15) and the graphic EQ Auto preamp. */
  preampDb: number;
  preampAuto: boolean;
  autoPreampValue: number;
  handlePreampChange: (db: number) => void | Promise<void>;
  handleTogglePreampAuto: () => void | Promise<void>;
  /** Clears the clip LED latch. */
  handleResetClipIndicator: () => void | Promise<void>;
  setIsParametricEqOpen: (open: boolean) => void;
  setIsAutoEqOpen: (open: boolean) => void;
  setIsDynamicsStudioOpen: (open: boolean) => void;
  showMessage: (msg: string, isError?: boolean) => void;
}

export const DspStudioView: React.FC<DspStudioViewProps> = (props) => {
  const {
    uiScale,
    loc,
    status: statusProp,
    dspAutoStartup,
    dspDefaultEngine,
    handleToggleDspAutoStartup,
    handleSaveDspStartupDefault,
    handleResetDsp,
  } = props;
  // Live position/spectrum (livePlayback): this component renders, not the whole app.
  const status = useLiveStatus(statusProp);

  return (
    <div
      className={cn(
        'mx-auto my-0 flex flex-col gap-5',
        uiScale >= 1.28 ? 'max-w-300' : uiScale >= 1.18 ? 'max-w-270' : uiScale >= 1.08 ? 'max-w-240' : 'max-w-220',
      )}
    >
      <PageHeader
        title={loc.dsp.title}
        description={loc.dsp.subtitle}
        icon={<Sliders size={18} />}
        tone="purple"
        actions={
          <>
            {/* Remember the DSP parameters at start-up */}
            <Chip pressed={dspAutoStartup} tone="green" onClick={handleToggleDspAutoStartup} title={loc.dsp.dspAutostart}>
              <Power size={13} /> {loc.dsp.dspAutostartShort}
            </Chip>
            {/* Save the current settings as the start-up default */}
            <Button variant="tinted" tone="amber" size="sm" onClick={handleSaveDspStartupDefault}>
              <Save size={13} /> {loc.dsp.dspSaveStartupBtn}
            </Button>
            {/* Default start-up engine */}
            <Badge title={loc.dsp.defaultEngineStartup}>
              Start: <strong className={dspDefaultEngine === 'Bypass' ? 'text-accent-green' : 'text-accent-pink'}>{dspDefaultEngine}</strong>
            </Badge>
            <Button size="sm" onClick={handleResetDsp}>
              <RotateCcw size={13} /> {loc.dsp.reset}
            </Button>
          </>
        }
      />

      {/* Engine choice (Bypass / Rubber Band / SoundTouch), block size and the Bypass notice */}
      <DspEngineSelector {...props} status={status} />

      {/* Pitch, tempo (time stretch) and rate: nudges, typed values, slider and presets */}
      <DspPitchSlider {...props} status={status} />
      <DspTempoSlider {...props} status={status} />
      <DspRateSlider {...props} status={status} />

      {/* Reverb (GStreamer Freeverb) */}
      <DspReverbPanel {...props} />

      {/* DSP presets (SQLite) and the signature profiles */}
      <DspPresetManager {...props} />

      {/* Bass boost, stereo widener, true-peak limiter and crossfeed */}
      <DspMasteringRack {...props} />

      {/* 10-band graphic equalizer */}
      <DspGraphicEqRack {...props} status={status} />

      {/* FFT spectrum analyser */}
      <Card>
        <SectionHeader
          icon={<Activity size={18} />}
          tone="cyan"
          title={loc.dsp.spectrumTitle}
          actions={<span className="font-mono text-xs text-fg-muted">16 FFT Bands | GStreamer FFT Analyzer (60 FPS)</span>}
        />
        <SpectrumVisualizer spectrum={status.spectrum} isPlaying={status.state === 'Playing'} className="mt-4 h-27.5 w-full" />
      </Card>
    </div>
  );
};
