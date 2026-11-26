import React, { useState, useEffect } from "react";
import {
  Activity,
  Info,
  RotateCcw,
  Save,
  Sliders,
} from "lucide-react";
import { SpectrumVisualizer } from '../../components/player/SpectrumVisualizer';
import {  type EqualizerPreset } from '../../types/equalizer';
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
import { Callout } from '../../components/ui';

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
  handleApplyEqPreset: (presetName: string) => void | Promise<void>;
  getEqPresetDisplayName: (name: string, locOrIsPl?: any) => string;
  handleResetEq: () => void | Promise<void>;
  handleEqToggle: () => void | Promise<void>;
  handleEqBandChange: (bandIndex: number, gainDb: number) => void | Promise<void>;
  setIsParametricEqOpen: (open: boolean) => void;
  setIsAutoEqOpen: (open: boolean) => void;
  setIsDynamicsStudioOpen: (open: boolean) => void;
  showMessage: (msg: string, isError?: boolean) => void;
}

export const DspStudioView: React.FC<DspStudioViewProps> = (props) => {
  const {
    uiScale,
    loc,
    language: _language,
    currentLang: _currentLang = _language,
    status: statusProp,
    dspAutoStartup,
    dspDefaultEngine,
    dspBlockSize,
    handleToggleDspAutoStartup,
    handleSaveDspStartupDefault,
    handleResetDsp,
    handleSetDspBlockSize,
  } = props;
  // Pozycja/spektrum na żywo (livePlayback) — renderuje się ten komponent, nie cała aplikacja.
  const status = useLiveStatus(statusProp);
  const [editingPitch, setEditingPitch] = useState<string | null>(null);
  const [editingTempo, setEditingTempo] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [isEqPresetMenuOpen, setIsEqPresetMenuOpen] = useState(false);

  useEffect(() => {
    if (!isEqPresetMenuOpen) return;
    const handleOutsideClick = () => setIsEqPresetMenuOpen(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsEqPresetMenuOpen(false);
    };
    window.addEventListener("click", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isEqPresetMenuOpen]);

  return (
            <div className={cn(
              'glass-panel mx-auto my-0 p-7',
              uiScale >= 1.28 ? 'max-w-300' : uiScale >= 1.18 ? 'max-w-270' : uiScale >= 1.08 ? 'max-w-240' : 'max-w-220',
            )}>
              <div className="mb-5.5 flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl">
                    <Sliders size={20} className="text-accent-purple" /> {loc.dsp.title}
                  </h2>
                  <p className="mt-1 text-ui text-fg-secondary">
                    {loc.dsp.subtitle}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Przełącznik zapamiętywania parametrów DSP przy starcie programu */}
                  <button
                    onClick={handleToggleDspAutoStartup}
                    title={loc.dsp.dspAutostart}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-ui font-semibold transition-all duration-150',
                      dspAutoStartup ? 'bg-accent-green/20' : 'bg-white/5',
                      dspAutoStartup ? 'border-accent-green' : 'border-line',
                      dspAutoStartup ? 'text-accent-green' : 'text-fg-muted',
                    )}
                  >
                    {dspAutoStartup ? `✓ ${loc.dsp.dspAutostartOn}` : `○ ${loc.dsp.dspAutostartOff}`}
                  </button>

                  {/* Zapisz bieżące ustawienia jako domyślne startowe */}
                  <button
                    onClick={handleSaveDspStartupDefault}
                    title={loc.dsp.dspSaveStartupBtn}
                    className="glass-card flex items-center gap-1.5 rounded-lg px-3 py-2 text-ui font-semibold text-accent-amber"
                  >
                    <Save size={13} /> {loc.dsp.dspSaveStartupBtn}
                  </button>

                  {/* Wskaźnik domyślnego silnika startowego */}
                  <span
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-fg-secondary"
                    title={loc.dsp.defaultEngineStartup}
                  >
                    Start: <strong className={cn(dspDefaultEngine === 'Bypass' ? 'text-accent-green' : 'text-accent-pink')}>{dspDefaultEngine}</strong>
                  </span>

                  {/* Reset do wartości domyślnych */}
                  <button
                    onClick={handleResetDsp}
                    className="glass-card flex items-center gap-1.5 px-3 py-2 text-ui font-semibold text-accent-cyan"
                  >
                    <RotateCcw size={13} /> {loc.dsp.reset}
                  </button>
                </div>
              </div>

              {/* Wybór silnika DSP: SoundTouch vs Rubber Band */}
              <DspEngineSelector {...props} status={status} />

              {/* Pasek telemetrii silnika */}
              <div
                className="mb-6 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-line bg-black/25 px-4 py-3 text-ui"
              >
                <span>{loc.dsp.engine}: <strong className="text-accent-pink">{status.capabilities?.name || 'SoundTouch'}</strong></span>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-fg-secondary">
                    {loc.dsp.blockBufferLabel}
                  </span>
                  <span className={cn(
                    'font-bold',
                    dspBlockSize === 2048 ? 'text-accent-green' : 'text-accent-cyan',
                  )}>
                    {dspBlockSize} {loc.settings.dspBlockSizeFrames}
                  </span>
                  {dspBlockSize === 2048 && (
                    <span className="rounded-lg bg-accent-green/20 px-1.5 py-px text-xxs font-semibold text-accent-green">
                      {loc.settings.dspBlockSizeDefault}
                    </span>
                  )}
                  {[
                    { label: '1024', val: 1024 },
                    { label: '2048 (Def)', val: 2048 },
                    { label: '4096', val: 4096 },
                  ].map((b) => (
                    <button
                      key={b.val}
                      onClick={() => handleSetDspBlockSize(b.val)}
                      className={cn(
                        'rounded-md border px-2 py-1 text-xs',
                        dspBlockSize === b.val ? 'font-bold' : 'font-medium',
                        dspBlockSize === b.val ? 'bg-sky-400/25' : 'bg-white/5',
                        dspBlockSize === b.val ? 'border-accent-cyan' : 'border-line',
                        dspBlockSize === b.val ? 'text-accent-cyan' : 'text-fg-secondary',
                      )}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Informacja o aktywnym trybie Direct Bypass */}
              {status.engine === 'Bypass' && (
                <Callout
                  tone="green" className="mb-5.5 flex items-center gap-2.5 text-ui leading-snug text-emerald-200"
                >
                  <Info size={18} className="shrink-0 text-accent-green" />
                  <span>{loc.dsp.bypassActiveNotice}</span>
                </Callout>
              )}

              {/* Suwak Pitch Shift z ergonomicznymi przyciskami oraz krokiem 0.1, 0.01 i ręcznym wpisaniem */}
              <DspPitchSlider {...props} status={status} editingPitch={editingPitch} setEditingPitch={setEditingPitch} />

              {/* Suwak Tempo (Time Stretch) z ergonomicznymi przyciskami oraz krokiem 0.1, 0.01 i ręcznym wpisaniem */}
              <DspTempoSlider {...props} status={status} editingTempo={editingTempo} setEditingTempo={setEditingTempo} />

              {/* Suwak Szybkości (Rate) z ergonomicznymi przyciskami oraz krokiem 0.1, 0.01 i ręcznym wpisaniem */}
              <DspRateSlider {...props} status={status} editingRate={editingRate} setEditingRate={setEditingRate} />

              {/* Panel Efektu Pogłosu Reverb (GStreamer Freeverb) */}
              <DspReverbPanel {...props} />

              {/* Menedżer presetów DSP (SQLite) */}
              <DspPresetManager {...props} />

              {/* SEKCJA 2.5: POWERAMP DSP STUDIO (BASS BOOST, STEREO WIDENER, TRUE-PEAK LIMITER) */}
              <DspMasteringRack {...props} />

              {/* SEKCJA 3: 10-PASMOWY KOREKTOR GRAFICZNY (EQUALIZER) */}
              <DspGraphicEqRack {...props} setIsEqPresetMenuOpen={setIsEqPresetMenuOpen} isEqPresetMenuOpen={isEqPresetMenuOpen} status={status} />

              {/* SEKCJA 4: NEONOWY ANALIZATOR WIDMA FFT (SPECTRUM VISUALIZER) */}
              <div className="mt-7 border-t border-line pt-6">
                <div className="mb-3.5 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-lg">
                    <Activity size={18} className="text-accent-cyan" /> {loc.dsp.spectrumTitle}
                  </h3>
                  <span className="font-mono text-xs text-fg-muted">
                    16 FFT Bands | GStreamer FFT Analyzer (60 FPS)
                  </span>
                </div>

                <SpectrumVisualizer
                  spectrum={status.spectrum}
                  isPlaying={status.state === 'Playing'}
                  className="h-27.5 w-full"
                />
              </div>
            </div>
  );
};
