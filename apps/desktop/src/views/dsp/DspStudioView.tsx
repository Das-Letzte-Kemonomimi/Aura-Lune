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
            <div className="glass-panel" style={{ padding: '28px', maxWidth: uiScale >= 1.28 ? '1200px' : uiScale >= 1.18 ? '1080px' : uiScale >= 1.08 ? '960px' : '880px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={20} color="var(--accent-purple)" /> {loc.dsp.title}
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {loc.dsp.subtitle}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Przełącznik zapamiętywania parametrów DSP przy starcie programu */}
                  <button
                    onClick={handleToggleDspAutoStartup}
                    title={loc.dsp.dspAutostart}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: dspAutoStartup ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${dspAutoStartup ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                      color: dspAutoStartup ? 'var(--accent-green)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {dspAutoStartup ? `✓ ${loc.dsp.dspAutostartOn}` : `○ ${loc.dsp.dspAutostartOff}`}
                  </button>

                  {/* Zapisz bieżące ustawienia jako domyślne startowe */}
                  <button
                    onClick={handleSaveDspStartupDefault}
                    title={loc.dsp.dspSaveStartupBtn}
                    className="glass-card"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--accent-amber)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Save size={13} /> {loc.dsp.dspSaveStartupBtn}
                  </button>

                  {/* Wskaźnik domyślnego silnika startowego */}
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                    title={loc.dsp.defaultEngineStartup}
                  >
                    Start: <strong style={{ color: dspDefaultEngine === 'Bypass' ? 'var(--accent-green)' : 'var(--accent-pink)' }}>{dspDefaultEngine}</strong>
                  </span>

                  {/* Reset do wartości domyślnych */}
                  <button
                    onClick={handleResetDsp}
                    className="glass-card"
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={13} /> {loc.dsp.reset}
                  </button>
                </div>
              </div>

              {/* Wybór silnika DSP: SoundTouch vs Rubber Band */}
              <DspEngineSelector {...props} status={status} />

              {/* Pasek telemetrii silnika */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px',
                  fontSize: '0.8rem',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <span>{loc.dsp.engine}: <strong style={{ color: 'var(--accent-pink)' }}>{status.capabilities?.name || 'SoundTouch'}</strong></span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                    {loc.dsp.blockBufferLabel}
                  </span>
                  <span style={{ fontWeight: 700, color: dspBlockSize === 2048 ? 'var(--accent-green)' : 'var(--accent-cyan)' }}>
                    {dspBlockSize} {loc.settings.dspBlockSizeFrames}
                  </span>
                  {dspBlockSize === 2048 && (
                    <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', fontWeight: 600 }}>
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
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: dspBlockSize === b.val ? 700 : 500,
                        background: dspBlockSize === b.val ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        border: dspBlockSize === b.val ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                        color: dspBlockSize === b.val ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Informacja o aktywnym trybie Direct Bypass */}
              {status.engine === 'Bypass' && (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    marginBottom: '22px',
                    fontSize: '0.8rem',
                    color: '#a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    lineHeight: 1.4,
                  }}
                >
                  <Info size={18} color="var(--accent-green)" style={{ flexShrink: 0 }} />
                  <span>{loc.dsp.bypassActiveNotice}</span>
                </div>
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
              <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={18} color="var(--accent-cyan)" /> {loc.dsp.spectrumTitle}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    16 FFT Bands | GStreamer FFT Analyzer (60 FPS)
                  </span>
                </div>

                <SpectrumVisualizer
                  spectrum={status.spectrum}
                  isPlaying={status.state === 'Playing'}
                  style={{ height: '110px', width: '100%' }}
                />
              </div>
            </div>
  );
};
