import React, { useState, useEffect } from "react";
import {
  Activity,
  Check,
  CheckCircle,
  ChevronDown,
  Flame,
  Headphones,
  Info,
  RotateCcw,
  Save,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { SpectrumVisualizer } from '../../components/player/SpectrumVisualizer';
import { EQUALIZER_BANDS, type EqualizerPreset } from '../../types/equalizer';
import type { DspPresetRecord, PlaybackStatus } from '../../types/player';
import { type Language, getTranslations } from '../../i18n';

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

export const DspStudioView: React.FC<DspStudioViewProps> = ({
  uiScale,
  loc,
  language: _language,
  currentLang: _currentLang = _language,
  status,
  activeTrackKeyBpm,
  dspAutoStartup,
  dspDefaultEngine,
  dspBlockSize,
  dspCombination,
  bassBoost,
  lastBassBoostRef,
  stereoWidenerActive,
  stereoWidenerAmount,
  limiterEnabled,
  crossfeedEnabled,
  crossfeedPreset,
  crossfeedFcut,
  crossfeedFeed,
  reverbEnabled,
  reverbRoomSize,
  reverbDamping,
  reverbWidth,
  reverbLevel,
  presets,
  eqAutoStartup,
  selectedEqPreset,
  eqPresets,
  newPresetName,
  setNewPresetName,
  handleToggleDspAutoStartup,
  handleSaveDspStartupDefault,
  handleResetDsp,
  handleEngineChange,
  handleSetDspBlockSize,
  handlePitchChange,
  handleTempoChange,
  handleRateChange,
  handleBassBoostChange,
  handleToggleStereoWidener,
  handleStereoWidenerAmountChange,
  handleToggleLimiter,
  handleSetCrossfeed,
  handleUpdateReverb,
  handleLoadPreset,
  handleSavePreset,
  handleApplySignatureProfile,
  handleToggleEqAutoStartup,
  handleApplyEqPreset,
  getEqPresetDisplayName,
  handleResetEq,
  handleEqToggle,
  handleEqBandChange,
  setIsParametricEqOpen,
  setIsAutoEqOpen,
  setIsDynamicsStudioOpen,
  showMessage,
}) => {
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
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '10px', fontWeight: 600 }}>
                  {loc.dsp.engine}:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  {/* Karta Bypass (Bez DSP / Czysty dźwięk) */}
                  <div
                    onClick={() => handleEngineChange('Bypass')}
                    className="glass-card"
                    style={{
                      padding: '16px',
                      cursor: 'pointer',
                      borderRadius: '14px',
                      border: status.engine === 'Bypass' ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                      background: status.engine === 'Bypass' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{loc.dsp.bypass}</span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: 'var(--accent-green)',
                        }}
                      >
                        DIRECT
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {loc.dsp.bypassDesc}
                    </p>
                  </div>

                  {/* Karta Rubber Band */}
                  <div
                    onClick={() => handleEngineChange('RubberBand')}
                    className="glass-card"
                    style={{
                      padding: '16px',
                      cursor: 'pointer',
                      borderRadius: '14px',
                      border: status.engine === 'RubberBand' ? '2px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                      background: status.engine === 'RubberBand' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{loc.dsp.rubberband}</span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(244, 63, 94, 0.2)',
                          color: 'var(--accent-pink)',
                        }}
                      >
                        HI-FI (MSC)
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {loc.dsp.rubberbandDesc}
                    </p>
                  </div>

                  {/* Karta SoundTouch */}
                  <div
                    onClick={() => handleEngineChange('SoundTouch')}
                    className="glass-card"
                    style={{
                      padding: '16px',
                      cursor: 'pointer',
                      borderRadius: '14px',
                      border: status.engine === 'SoundTouch' ? '2px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                      background: status.engine === 'SoundTouch' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{loc.dsp.soundtouch}</span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(56, 189, 248, 0.2)',
                          color: 'var(--accent-cyan)',
                        }}
                      >
                        LOW CPU
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {loc.dsp.soundtouchDesc}
                    </p>
                  </div>
                </div>
              </div>

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
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>{loc.dsp.pitch}:</label>
                    <button
                      onClick={() => handlePitchChange(Math.max(-24, Math.round(((status.pitch_semitones ?? 0) - 0.1) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="-0.1 semitone"
                    >
                      -0.1
                    </button>
                    <button
                      onClick={() => handlePitchChange(Math.max(-24, Math.round(((status.pitch_semitones ?? 0) - 0.01) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="-0.01 semitone"
                    >
                      -0.01
                    </button>
                    <button
                      onClick={() => handlePitchChange(Math.min(24, Math.round(((status.pitch_semitones ?? 0) + 0.01) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="+0.01 semitone"
                    >
                      +0.01
                    </button>
                    <button
                      onClick={() => handlePitchChange(Math.min(24, Math.round(((status.pitch_semitones ?? 0) + 0.1) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="+0.1 semitone"
                    >
                      +0.1
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="text"
                        value={
                          editingPitch !== null
                            ? editingPitch
                            : (status.pitch_semitones ?? 0) > 0
                              ? `+${(status.pitch_semitones ?? 0).toFixed(2)}`
                              : (status.pitch_semitones ?? 0).toFixed(2)
                        }
                        onFocus={(e) => {
                          setEditingPitch(
                            (status.pitch_semitones ?? 0) > 0
                              ? `+${(status.pitch_semitones ?? 0).toFixed(2)}`
                              : (status.pitch_semitones ?? 0).toFixed(2)
                          );
                          e.target.select();
                        }}
                        onChange={(e) => setEditingPitch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            const step = e.shiftKey ? 0.01 : 0.1;
                            const clean = (editingPitch ?? `${status.pitch_semitones ?? 0}`).replace(',', '.').trim();
                            const current = parseFloat(clean);
                            if (!isNaN(current)) {
                              const next = Math.min(24, Math.round((current + step) * 100) / 100);
                              setEditingPitch(next > 0 ? `+${next.toFixed(2)}` : next.toFixed(2));
                              handlePitchChange(next);
                            }
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            const step = e.shiftKey ? 0.01 : 0.1;
                            const clean = (editingPitch ?? `${status.pitch_semitones ?? 0}`).replace(',', '.').trim();
                            const current = parseFloat(clean);
                            if (!isNaN(current)) {
                              const next = Math.max(-24, Math.round((current - step) * 100) / 100);
                              setEditingPitch(next > 0 ? `+${next.toFixed(2)}` : next.toFixed(2));
                              handlePitchChange(next);
                            }
                          } else if (e.key === 'Enter') {
                            const clean = (editingPitch ?? '').replace(',', '.').trim();
                            const val = parseFloat(clean);
                            if (!isNaN(val)) {
                              const min = status.capabilities?.min_pitch_semitones ?? -24;
                              const max = status.capabilities?.max_pitch_semitones ?? 24;
                              const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                              handlePitchChange(clamped);
                            }
                            setEditingPitch(null);
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            setEditingPitch(null);
                            e.currentTarget.blur();
                          }
                        }}
                        onBlur={() => {
                          if (editingPitch !== null) {
                            const clean = editingPitch.replace(',', '.').trim();
                            const val = parseFloat(clean);
                            if (!isNaN(val)) {
                              const min = status.capabilities?.min_pitch_semitones ?? -24;
                              const max = status.capabilities?.max_pitch_semitones ?? 24;
                              const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                              handlePitchChange(clamped);
                            }
                            setEditingPitch(null);
                          }
                        }}
                        placeholder="0.00"
                        title={loc.dsp.enterValuePitch}
                        style={{
                          width: '60px',
                          padding: '2px 6px',
                          fontSize: '0.82rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          textAlign: 'center',
                          color: 'var(--accent-pink)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(244, 63, 94, 0.4)',
                          borderRadius: '6px',
                          outline: 'none',
                          cursor: 'text',
                        }}
                      />
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-pink)', fontWeight: 600, fontSize: '0.85rem' }}>
                        {loc.dsp.semitones} ({Math.round((status.pitch_semitones ?? 0) * 100)} {loc.dsp.cents}) | {(2 ** ((status.pitch_semitones ?? 0) / 12)).toFixed(3)}x
                      </span>
                    </div>
                    {/* Wskaźnik wynikowej tonacji (Key) pod wskaźnikiem */}
                    <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-pink)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {dspCombination.totalKey ? (
                        <span>
                          🎯 {loc.dsp.keyLabel}: <strong style={{ color: '#fff' }}>{dspCombination.totalKey.camelot}</strong> ({dspCombination.totalKey.keyName})
                          {dspCombination.totalKey.centsOffset !== 0 ? ` ${dspCombination.totalKey.centsOffset > 0 ? '+' : ''}${dspCombination.totalKey.centsOffset}¢` : ''}
                          {dspCombination.hasRate && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--accent-amber)', marginLeft: '4px' }}>
                              (Σ {dspCombination.totalPitchSemitones > 0 ? `+${dspCombination.totalPitchSemitones.toFixed(2)}` : dspCombination.totalPitchSemitones.toFixed(2)} st)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>
                          🎯 {loc.dsp.keyLabel}: {dspCombination.totalPitchSemitones > 0 ? `+${dspCombination.totalPitchSemitones.toFixed(2)}` : dspCombination.totalPitchSemitones.toFixed(2)} st
                          {dspCombination.hasRate && ` (${(status.pitch_semitones ?? 0).toFixed(2)} st + rate ${(dspCombination.rateSemitones > 0 ? '+' : '') + dspCombination.rateSemitones.toFixed(2)} st)`}
                          {loc.dsp.noBaseKey}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <input
                  type="range"
                  min={status.capabilities?.min_pitch_semitones ?? -12}
                  max={status.capabilities?.max_pitch_semitones ?? 12}
                  step={0.01}
                  value={status.pitch_semitones ?? 0}
                  onChange={(e) => handlePitchChange(Number(e.target.value))}
                  style={{ width: '100%', marginBottom: '12px' }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[-12, -7, -2, 0, 2, 7, 12].map((st) => (
                    <button
                      key={st}
                      onClick={() => handlePitchChange(st)}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        background: st === 0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: st === 0 ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                        color: st === 0 ? 'var(--accent-cyan)' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {st === 0 ? `0 ${loc.dsp.semitones}` : st > 0 ? `+${st}` : st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suwak Tempo (Time Stretch) z ergonomicznymi przyciskami oraz krokiem 0.1, 0.01 i ręcznym wpisaniem */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>{loc.dsp.tempo}:</label>
                    <button
                      onClick={() => handleTempoChange(Math.max(0.1, Math.round(((status.tempo_ratio ?? 1) - 0.1) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="-0.1x"
                    >
                      -0.1x
                    </button>
                    <button
                      onClick={() => handleTempoChange(Math.max(0.1, Math.round(((status.tempo_ratio ?? 1) - 0.01) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="-0.01x"
                    >
                      -0.01x
                    </button>
                    <button
                      onClick={() => handleTempoChange(Math.min(3.0, Math.round(((status.tempo_ratio ?? 1) + 0.01) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="+0.01x"
                    >
                      +0.01x
                    </button>
                    <button
                      onClick={() => handleTempoChange(Math.min(3.0, Math.round(((status.tempo_ratio ?? 1) + 0.1) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="+0.1x"
                    >
                      +0.1x
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="text"
                        value={
                          editingTempo !== null
                            ? editingTempo
                            : (status.tempo_ratio ?? 1).toFixed(2)
                        }
                        onFocus={(e) => {
                          setEditingTempo((status.tempo_ratio ?? 1).toFixed(2));
                          e.target.select();
                        }}
                        onChange={(e) => setEditingTempo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            const step = e.shiftKey ? 0.01 : 0.1;
                            const clean = (editingTempo ?? `${status.tempo_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                            const current = parseFloat(clean);
                            if (!isNaN(current)) {
                              const next = Math.min(3.0, Math.round((current + step) * 100) / 100);
                              setEditingTempo(next.toFixed(2));
                              handleTempoChange(next);
                            }
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            const step = e.shiftKey ? 0.01 : 0.1;
                            const clean = (editingTempo ?? `${status.tempo_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                            const current = parseFloat(clean);
                            if (!isNaN(current)) {
                              const next = Math.max(0.1, Math.round((current - step) * 100) / 100);
                              setEditingTempo(next.toFixed(2));
                              handleTempoChange(next);
                            }
                          } else if (e.key === 'Enter') {
                            const clean = (editingTempo ?? '').replace('x', '').replace('X', '').replace(',', '.').trim();
                            const val = parseFloat(clean);
                            if (!isNaN(val)) {
                              const min = status.capabilities?.min_tempo_ratio ?? 0.1;
                              const max = status.capabilities?.max_tempo_ratio ?? 3.0;
                              const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                              handleTempoChange(clamped);
                            }
                            setEditingTempo(null);
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            setEditingTempo(null);
                            e.currentTarget.blur();
                          }
                        }}
                        onBlur={() => {
                          if (editingTempo !== null) {
                            const clean = editingTempo.replace('x', '').replace('X', '').replace(',', '.').trim();
                            const val = parseFloat(clean);
                            if (!isNaN(val)) {
                              const min = status.capabilities?.min_tempo_ratio ?? 0.1;
                              const max = status.capabilities?.max_tempo_ratio ?? 3.0;
                              const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                              handleTempoChange(clamped);
                            }
                            setEditingTempo(null);
                          }
                        }}
                        placeholder="1.00"
                        title={loc.dsp.enterValueTempo}
                        style={{
                          width: '60px',
                          padding: '2px 6px',
                          fontSize: '0.82rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          textAlign: 'center',
                          color: 'var(--accent-cyan)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(6, 182, 212, 0.4)',
                          borderRadius: '6px',
                          outline: 'none',
                          cursor: 'text',
                        }}
                      />
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.85rem' }}>
                        x ({Math.round((status.tempo_ratio ?? 1) * 100)}%)
                      </span>
                    </div>
                    {/* Wskaźnik wynikowego tempa (BPM) pod wskaźnikiem */}
                    <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {dspCombination.totalBpm ? (
                        <span>
                          ⚡ Tempo: <strong style={{ color: '#fff' }}>{dspCombination.totalBpm.toFixed(1)} BPM</strong>
                          {activeTrackKeyBpm?.bpm ? ` (${loc.dsp.fromBpm} ${activeTrackKeyBpm.bpm.toFixed(1)})` : ''}
                          {dspCombination.hasRate && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--accent-amber)', marginLeft: '4px' }}>
                              (Σ {dspCombination.totalSpeedRatio.toFixed(2)}x)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>
                          ⚡ Tempo: {dspCombination.totalSpeedRatio.toFixed(2)}x
                          {dspCombination.hasRate && ` (${(status.tempo_ratio ?? 1).toFixed(2)}x × rate ${(status.rate_ratio ?? 1).toFixed(2)}x)`}
                          {loc.dsp.noBaseBpm}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <input
                  type="range"
                  min={status.capabilities?.min_tempo_ratio ?? 0.5}
                  max={status.capabilities?.max_tempo_ratio ?? 2.0}
                  step={0.01}
                  value={status.tempo_ratio ?? 1}
                  onChange={(e) => handleTempoChange(Number(e.target.value))}
                  style={{ width: '100%', marginBottom: '12px' }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0.75, 1.0, 1.25, 1.5, 1.75].map((tr) => (
                    <button
                      key={tr}
                      onClick={() => handleTempoChange(tr)}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        background: tr === 1.0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: tr === 1.0 ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                        color: tr === 1.0 ? 'var(--accent-cyan)' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {tr === 1.0 ? '1.0x' : `${tr}x`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suwak Szybkości (Rate) z ergonomicznymi przyciskami oraz krokiem 0.1, 0.01 i ręcznym wpisaniem */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {loc.dsp.speed}:
                    </label>
                    <button
                      onClick={() => handleRateChange(Math.max(0.1, Math.round(((status.rate_ratio ?? 1) - 0.1) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="-0.1x"
                    >
                      -0.1x
                    </button>
                    <button
                      onClick={() => handleRateChange(Math.max(0.1, Math.round(((status.rate_ratio ?? 1) - 0.01) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="-0.01x"
                    >
                      -0.01x
                    </button>
                    <button
                      onClick={() => handleRateChange(Math.min(3.0, Math.round(((status.rate_ratio ?? 1) + 0.01) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="+0.01x"
                    >
                      +0.01x
                    </button>
                    <button
                      onClick={() => handleRateChange(Math.min(3.0, Math.round(((status.rate_ratio ?? 1) + 0.1) * 100) / 100))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="+0.1x"
                    >
                      +0.1x
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="text"
                        value={
                          editingRate !== null
                            ? editingRate
                            : (status.rate_ratio ?? 1).toFixed(2)
                        }
                        onFocus={(e) => {
                          setEditingRate((status.rate_ratio ?? 1).toFixed(2));
                          e.target.select();
                        }}
                        onChange={(e) => setEditingRate(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            const step = e.shiftKey ? 0.01 : 0.1;
                            const clean = (editingRate ?? `${status.rate_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                            const current = parseFloat(clean);
                            if (!isNaN(current)) {
                              const next = Math.min(3.0, Math.round((current + step) * 100) / 100);
                              setEditingRate(next.toFixed(2));
                              handleRateChange(next);
                            }
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            const step = e.shiftKey ? 0.01 : 0.1;
                            const clean = (editingRate ?? `${status.rate_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                            const current = parseFloat(clean);
                            if (!isNaN(current)) {
                              const next = Math.max(0.1, Math.round((current - step) * 100) / 100);
                              setEditingRate(next.toFixed(2));
                              handleRateChange(next);
                            }
                          } else if (e.key === 'Enter') {
                            const clean = (editingRate ?? '').replace('x', '').replace('X', '').replace(',', '.').trim();
                            const val = parseFloat(clean);
                            if (!isNaN(val)) {
                              const clamped = Math.max(0.1, Math.min(3.0, Math.round(val * 100) / 100));
                              handleRateChange(clamped);
                            }
                            setEditingRate(null);
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            setEditingRate(null);
                            e.currentTarget.blur();
                          }
                        }}
                        onBlur={() => {
                          if (editingRate !== null) {
                            const clean = editingRate.replace('x', '').replace('X', '').replace(',', '.').trim();
                            const val = parseFloat(clean);
                            if (!isNaN(val)) {
                              const clamped = Math.max(0.1, Math.min(3.0, Math.round(val * 100) / 100));
                              handleRateChange(clamped);
                            }
                            setEditingRate(null);
                          }
                        }}
                        placeholder="1.00"
                        title={loc.dsp.enterValueSpeed}
                        style={{
                          width: '60px',
                          padding: '2px 6px',
                          fontSize: '0.82rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          textAlign: 'center',
                          color: 'var(--accent-amber)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          borderRadius: '6px',
                          outline: 'none',
                          cursor: 'text',
                        }}
                      />
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', fontWeight: 600, fontSize: '0.85rem' }}>
                        x ({Math.round((status.rate_ratio ?? 1) * 100)}%)
                      </span>
                    </div>
                    {/* Wskaźnik wynikowej tonacji i tempa pod wskaźnikiem */}
                    <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {dspCombination.totalKey ? (
                        <span>
                          🎯 {loc.dsp.keyLabel}: <strong style={{ color: '#fff' }}>{dspCombination.totalKey.camelot}</strong> ({dspCombination.totalKey.keyName})
                          {dspCombination.totalKey.centsOffset !== 0 ? ` ${dspCombination.totalKey.centsOffset > 0 ? '+' : ''}${dspCombination.totalKey.centsOffset}¢` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>
                          🎯 {loc.dsp.keyLabel}: {(dspCombination.totalPitchSemitones > 0 ? '+' : '') + dspCombination.totalPitchSemitones.toFixed(2)} st
                        </span>
                      )}
                      <span>•</span>
                      {dspCombination.totalBpm ? (
                        <span>
                          ⚡ Tempo: <strong style={{ color: '#fff' }}>{dspCombination.totalBpm.toFixed(1)} BPM</strong>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>
                          ⚡ Tempo: {dspCombination.totalSpeedRatio.toFixed(2)}x
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.01}
                  value={status.rate_ratio ?? 1}
                  onChange={(e) => handleRateChange(Number(e.target.value))}
                  style={{ width: '100%', marginBottom: '12px' }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0.8, 0.9, 1.0, 1.1, 1.25].map((r) => (
                    <button
                      key={r}
                      onClick={() => handleRateChange(r)}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        background: r === 1.0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: r === 1.0 ? '1px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
                        color: r === 1.0 ? 'var(--accent-amber)' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {r === 1.0 ? '1.0x' : `${r}x`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Panel Efektu Pogłosu Reverb (GStreamer Freeverb) */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.28)',
                  padding: '20px',
                  borderRadius: '16px',
                  border: `1px solid ${reverbEnabled ? 'rgba(168, 85, 247, 0.4)' : 'var(--border-subtle)'}`,
                  marginBottom: '28px',
                  boxShadow: reverbEnabled ? '0 4px 20px rgba(168, 85, 247, 0.15)' : 'none',
                  transition: 'all 0.25s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sparkles size={20} color={reverbEnabled ? 'var(--accent-purple)' : 'var(--text-muted)'} />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                        {loc.dsp.spatialReverbTitle}
                      </h4>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {loc.dsp.spatialReverbDesc}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUpdateReverb(!reverbEnabled)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      background: reverbEnabled ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${reverbEnabled ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                      color: reverbEnabled ? 'var(--accent-purple)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {reverbEnabled ? '● REVERB ON' : '○ REVERB BYPASS'}
                  </button>
                </div>

                {/* Suwaki parametrów Reverb */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', opacity: reverbEnabled ? 1 : 0.45 }}>
                  {/* Rozmiar pomieszczenia (Room Size) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Room Size (Rozmiar):</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbRoomSize * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={!reverbEnabled}
                      value={reverbRoomSize}
                      onChange={(e) => handleUpdateReverb(true, Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Tłumienie (Damping) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{loc.dsp.dampingLabel}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbDamping * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={!reverbEnabled}
                      value={reverbDamping}
                      onChange={(e) => handleUpdateReverb(true, undefined, Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Szerokość stereo (Width) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{loc.dsp.stereoWidthLabel}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbWidth * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={!reverbEnabled}
                      value={reverbWidth}
                      onChange={(e) => handleUpdateReverb(true, undefined, undefined, Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Poziom pogłosu (Wet Level) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Wet Level (Nasycenie):</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbLevel * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={!reverbEnabled}
                      value={reverbLevel}
                      onChange={(e) => handleUpdateReverb(true, undefined, undefined, undefined, Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Szybkie presety pogłosu */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    Presety:
                  </span>
                  <button
                    onClick={() => handleUpdateReverb(true, 0.40, 0.50, 0.70, 0.25)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Small Room
                  </button>
                  <button
                    onClick={() => handleUpdateReverb(true, 0.70, 0.30, 0.90, 0.35)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Ambient Hall
                  </button>
                  <button
                    onClick={() => handleUpdateReverb(true, 0.85, 0.15, 1.0, 0.45)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Cathedral
                  </button>
                  {/* Wymarzony profil użytkowniczki: Slowed + Reverb */}
                  <button
                    onClick={() => {
                      handleTempoChange(0.82);
                      handlePitchChange(-2.0);
                      handleUpdateReverb(true, 0.75, 0.35, 1.0, 0.40);
                      showMessage('Aktywowano profil: Slowed + Reverb 🌌');
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.3), rgba(168, 85, 247, 0.3))',
                      border: '1px solid var(--accent-pink)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    🌌 Slowed + Reverb
                  </button>
                </div>
              </div>

              {/* Menedżer presetów DSP (SQLite) */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  padding: '16px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '28px',
                }}
              >
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  {loc.dsp.eqPresets}:
                </label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: presets.length > 0 ? '12px' : '0' }}>
                  <input
                    type="text"
                    placeholder={loc.dsp.presetNamePlaceholder}
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(0,0,0,0.3)',
                      color: '#fff',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button
                    onClick={handleSavePreset}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                      color: '#fff',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Save size={14} /> {loc.dsp.savePreset}
                  </button>
                </div>

                {/* Profile Sygnaturowe 1.0 */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-pink)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} /> Profile Sygnaturowe Auralune 1.0 (Mastering Profiles)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                    <button
                      onClick={() => handleApplySignatureProfile('vocal_air')}
                      className="glass-card"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(168, 85, 247, 0.15))',
                        border: '1px solid rgba(244, 63, 94, 0.4)',
                        color: '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>🌸 Anime Vocal Air</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{loc.dsp.vocalPreserveDesc}</span>
                    </button>

                    <button
                      onClick={() => handleApplySignatureProfile('lofi_tape')}
                      className="glass-card"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(235, 116, 34, 0.2), rgba(168, 85, 247, 0.15))',
                        border: '1px solid rgba(235, 116, 34, 0.4)',
                        color: '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>☕ Midnight Lo-Fi Tape</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{loc.dsp.tapeWarmthDesc}</span>
                    </button>

                    <button
                      onClick={() => handleApplySignatureProfile('bit_perfect')}
                      className="glass-card"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(6, 182, 212, 0.15))',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                        color: '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>🎧 Bit-Perfect Direct</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{loc.dsp.bitPerfectDesc}</span>
                    </button>

                    <button
                      onClick={() => handleApplySignatureProfile('nightcore')}
                      className="glass-card"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2))',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        color: '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>⚡ Nightcore Club Anthem</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{loc.dsp.nightcoreProfileDesc}</span>
                    </button>

                    <button
                      onClick={() => handleApplySignatureProfile('slowed')}
                      className="glass-card"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(168, 85, 247, 0.15))',
                        border: '1px solid rgba(6, 182, 212, 0.4)',
                        color: '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>🌌 Ambient Slowed & Space</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{loc.dsp.slowedProfileDesc}</span>
                    </button>
                  </div>
                </div>

                {presets.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleLoadPreset(p)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#fff',
                          background: 'rgba(25, 28, 48, 0.7)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        <Sparkles size={12} color="var(--accent-pink)" />
                        <span>{p.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                          ({p.pitch_semitones > 0 ? `+${p.pitch_semitones}` : p.pitch_semitones}st, {p.tempo_ratio}x)
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SEKCJA 2.5: POWERAMP DSP STUDIO (BASS BOOST, STEREO WIDENER, TRUE-PEAK LIMITER) */}
              <div
                style={{
                  marginTop: '24px',
                  padding: '20px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                }}
              >
                {/* KARTA 1: BASS BOOST (SUB-BAS EXCITER) */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 77, 148, 0.05)',
                    border: '1px solid rgba(255, 77, 148, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Flame size={18} color="var(--accent-pink)" />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                          {loc.dsp.bassBoostTitle}
                        </h4>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {loc.dsp.bassBoostDesc}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleBassBoostChange(bassBoost > 0 ? 0 : (lastBassBoostRef?.current || 6))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: bassBoost > 0 ? 'rgba(255, 77, 148, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                        border: `1px solid ${bassBoost > 0 ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
                        color: bassBoost > 0 ? 'var(--accent-pink)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {bassBoost > 0 ? `● BASS +${bassBoost.toFixed(1)} dB` : '○ BYPASS'}
                    </button>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={12}
                    step={0.5}
                    value={bassBoost}
                    onChange={(e) => handleBassBoostChange(Number(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[0, 3, 6, 9, 12].map((db) => (
                      <button
                        key={db}
                        onClick={() => handleBassBoostChange(db)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: bassBoost === db ? 'rgba(255, 77, 148, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${bassBoost === db ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
                          color: bassBoost === db ? 'var(--accent-pink)' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {db === 0 ? '0 dB (Off)' : `+${db} dB`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* KARTA 2: STEREO WIDENER (BAZA STEREO) */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(56, 189, 248, 0.05)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SlidersHorizontal size={18} color="var(--accent-cyan)" />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                          {loc.dsp.stereoWidenerTitle}
                        </h4>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {loc.dsp.stereoWidenerDesc}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleStereoWidener(!stereoWidenerActive)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: stereoWidenerActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                        border: `1px solid ${stereoWidenerActive ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                        color: stereoWidenerActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {stereoWidenerActive ? '● WIDENER ON' : '○ BYPASS'}
                    </button>
                  </div>

                  <div style={{ opacity: stereoWidenerActive ? 1 : 0.45 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{loc.dsp.stereoStageWidth}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {Math.round(stereoWidenerAmount * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={stereoWidenerAmount}
                      onChange={(e) => handleStereoWidenerAmountChange(Number(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                  </div>
                </div>

                {/* KARTA 3: TRUE-PEAK LIMITER */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(34, 197, 94, 0.05)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={18} color="var(--accent-green)" />
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                            {loc.dsp.limiterTitle}
                          </h4>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {loc.dsp.limiterDesc}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleLimiter(!limiterEnabled)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: limiterEnabled ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                          border: `1px solid ${limiterEnabled ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                          color: limiterEnabled ? 'var(--accent-green)' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {limiterEnabled ? '● LIMITER ON' : '○ BYPASS'}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      fontSize: '0.75rem',
                      color: limiterEnabled ? '#86efac' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <CheckCircle size={14} />
                    <span>
                      {limiterEnabled
                        ? loc.dsp.limiterDesc
                        : loc.dsp.limiterOffWarning}
                    </span>
                  </div>
                </div>

                {/* KARTA 4: BAUER HEADPHONE CROSSFEED (BS2B) */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(168, 85, 247, 0.05)',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Headphones size={18} color="var(--accent-purple, #c084fc)" />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                          {loc.settings.crossfeedTitle}
                        </h4>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {loc.settings.crossfeedDesc}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSetCrossfeed(!crossfeedEnabled, crossfeedPreset)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: crossfeedEnabled ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                        border: `1px solid ${crossfeedEnabled ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                        color: crossfeedEnabled ? 'var(--accent-purple)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {crossfeedEnabled ? '● CROSSFEED ON' : '○ BYPASS'}
                    </button>
                  </div>

                  <div style={{ opacity: crossfeedEnabled ? 1 : 0.65, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {([
                        { id: 'Default', label: 'Default (700Hz/4.5dB)' },
                        { id: 'ChuMoy', label: 'Chu Moy (700Hz/6dB)' },
                        { id: 'JanMeier', label: 'Jan Meier (650Hz/9dB)' },
                        { id: 'Custom', label: loc.settings.crossfeedPresetCustom },
                      ] as const).map((p) => {
                        const isActive = crossfeedPreset === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleSetCrossfeed(true, p.id)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              background: isActive && crossfeedEnabled ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                              border: `1px solid ${isActive && crossfeedEnabled ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                              color: isActive && crossfeedEnabled ? 'var(--accent-purple)' : 'var(--text-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>

                    {crossfeedPreset === 'Custom' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '2px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{loc.settings.crossfeedFcut}:</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{crossfeedFcut} Hz</span>
                          </div>
                          <input
                            type="range"
                            min="300"
                            max="2000"
                            step="25"
                            value={crossfeedFcut}
                            onChange={(e) => handleSetCrossfeed(true, 'Custom', parseInt(e.target.value, 10), crossfeedFeed)}
                            style={{ width: '100%', cursor: 'pointer' }}
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '2px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{loc.settings.crossfeedFeed}:</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{(crossfeedFeed / 10).toFixed(1)} dB</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="150"
                            step="5"
                            value={crossfeedFeed}
                            onChange={(e) => handleSetCrossfeed(true, 'Custom', crossfeedFcut, parseInt(e.target.value, 10))}
                            style={{ width: '100%', cursor: 'pointer' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SEKCJA 3: 10-PASMOWY KOREKTOR GRAFICZNY (EQUALIZER) */}
              <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sliders size={18} color="var(--accent-pink)" /> {loc.dsp.equalizer}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {loc.dsp.eqDesc}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Wybór presetu EQ - nowoczesne anime glassmorphism dropdown */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEqPresetMenuOpen((prev) => !prev);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          background: 'rgba(20, 24, 44, 0.95)',
                          color: '#ffffff',
                          border: isEqPresetMenuOpen ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          transition: 'all 0.18s ease',
                        }}
                        title={loc.dsp.eqPresets}
                      >
                        <Sliders size={13} color="var(--accent-pink)" />
                        <span>{getEqPresetDisplayName(selectedEqPreset, loc)}</span>
                        <ChevronDown
                          size={12}
                          style={{
                            color: 'var(--text-muted)',
                            transform: isEqPresetMenuOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.18s ease',
                          }}
                        />
                      </button>

                      {isEqPresetMenuOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            minWidth: '220px',
                            background: 'rgba(18, 22, 38, 0.98)',
                            backdropFilter: 'blur(16px)',
                            borderRadius: '12px',
                            border: '1px solid var(--border-accent)',
                            boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
                            padding: '6px',
                            zIndex: 1000,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            animation: 'fadeIn 0.15s ease-out',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '4px 8px', fontWeight: 600 }}>
                            {loc.dsp.eqPresets}
                          </div>

                          {/* Opcja Własny (Custom) jeśli suwaki zostały zmienione ręcznie */}
                          {selectedEqPreset &&
                            !eqPresets.some(
                              (p) =>
                                p.name === selectedEqPreset ||
                                getEqPresetDisplayName(p.name, true) === getEqPresetDisplayName(selectedEqPreset, true)
                            ) && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '7px 10px',
                                  borderRadius: '8px',
                                  background: 'rgba(255, 77, 148, 0.12)',
                                  color: 'var(--accent-pink)',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  marginBottom: '4px',
                                }}
                              >
                                <span>{getEqPresetDisplayName(selectedEqPreset, loc)}</span>
                                <Check size={13} color="var(--accent-pink)" />
                              </div>
                            )}

                          {eqPresets.map((preset) => {
                            const isSelected =
                              selectedEqPreset === preset.name ||
                              getEqPresetDisplayName(selectedEqPreset, true) === getEqPresetDisplayName(preset.name, true);
                            const displayName = getEqPresetDisplayName(preset.name, loc);
                            return (
                              <button
                                key={preset.name}
                                type="button"
                                onClick={() => handleApplyEqPreset(preset.name)}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '7px 10px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: isSelected ? 'rgba(255, 77, 148, 0.15)' : 'transparent',
                                  color: isSelected ? 'var(--accent-pink)' : '#fff',
                                  fontSize: '0.8rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <span>{displayName}</span>
                                {isSelected && <Check size={13} color="var(--accent-pink)" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Przycisk Reset EQ */}
                    <button
                      onClick={handleResetEq}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      {loc.dsp.reset} (0 dB)
                    </button>

                    {/* Przycisk Bazy Profili Słuchawkowych AutoEQ */}
                    <button
                      onClick={() => setIsAutoEqOpen(true)}
                      title={loc.dsp.autoEqHarmanTooltip}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: 'rgba(59, 130, 246, 0.2)',
                        border: '1px solid rgba(59, 130, 246, 0.45)',
                        color: '#60a5fa',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Headphones size={13} /> AutoEQ
                    </button>

                    {/* Przycisk Wielopasmowego Korektora Parametrycznego PEQ */}
                    <button
                      onClick={() => setIsParametricEqOpen(true)}
                      title={loc.parametricEq.subtitle}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: status.parametric_eq_enabled ? 'rgba(168, 85, 247, 0.32)' : 'rgba(168, 85, 247, 0.16)',
                        border: status.parametric_eq_enabled ? '1px solid rgba(168, 85, 247, 0.7)' : '1px solid rgba(168, 85, 247, 0.35)',
                        color: status.parametric_eq_enabled ? '#f3e8ff' : '#c084fc',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: status.parametric_eq_enabled ? '0 0 10px rgba(168, 85, 247, 0.3)' : 'none',
                      }}
                    >
                      <Sliders size={13} /> PEQ Studio
                      {status.parametric_eq_enabled && (
                        <span
                          style={{
                            display: 'inline-block',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#c084fc',
                            boxShadow: '0 0 6px #e879f9',
                          }}
                        />
                      )}
                    </button>

                    {/* Przycisk Studia Dynamiki & Lampy (Kompresor / Saturator / Limiter) */}
                    <button
                      onClick={() => setIsDynamicsStudioOpen(true)}
                      title={loc.dsp.dynamicsStudioTooltip}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background:
                          status.compressor_enabled || status.saturator_enabled
                            ? 'rgba(236, 72, 153, 0.3)'
                            : 'rgba(236, 72, 153, 0.14)',
                        border:
                          status.compressor_enabled || status.saturator_enabled
                            ? '1px solid rgba(236, 72, 153, 0.7)'
                            : '1px solid rgba(236, 72, 153, 0.35)',
                        color:
                          status.compressor_enabled || status.saturator_enabled ? '#fdf4ff' : '#f472b6',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow:
                          status.compressor_enabled || status.saturator_enabled
                            ? '0 0 10px rgba(236, 72, 153, 0.3)'
                            : 'none',
                      }}
                    >
                      <Activity size={13} /> Dynamics Studio
                      {(status.compressor_enabled || status.saturator_enabled) && (
                        <span
                          style={{
                            display: 'inline-block',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#ec4899',
                            boxShadow: '0 0 6px #f472b6',
                          }}
                        />
                      )}
                    </button>

                    {/* Przełącznik Włącz / Wyłącz EQ (Bypass) */}
                    <button
                      onClick={handleEqToggle}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: status.equalizer_enabled !== false ? 'rgba(255, 77, 148, 0.25)' : 'rgba(255,255,255,0.06)',
                        border: status.equalizer_enabled !== false ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                        color: status.equalizer_enabled !== false ? 'var(--accent-pink)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {status.equalizer_enabled !== false ? `● ${loc.dsp.eqEnabled}` : `○ ${loc.dsp.eqBypass}`}
                    </button>

                    {/* Przełącznik autostartu EQ */}
                    <button
                      onClick={handleToggleEqAutoStartup}
                      title={loc.dsp.eqAutostart}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: eqAutoStartup ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${eqAutoStartup ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                        color: eqAutoStartup ? 'var(--accent-green)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {eqAutoStartup ? `✓ ${loc.dsp.eqAutostartOn}` : `○ ${loc.dsp.eqAutostartOff}`}
                    </button>
                  </div>
                </div>

                {/* 10 pasm w ergonomicznym układzie 2-kolumnowym */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    background: 'rgba(0,0,0,0.25)',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {EQUALIZER_BANDS.map((band, idx) => {
                    const gain = (status.equalizer_bands && status.equalizer_bands[idx]) ?? 0;
                    return (
                      <div
                        key={band.freq}
                        style={{
                          padding: '10px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          background: 'rgba(25, 28, 48, 0.6)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginRight: '6px' }}>
                              {band.freq}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              ({band.label})
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: gain > 0 ? 'rgba(255, 77, 148, 0.2)' : gain < 0 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.06)',
                              color: gain > 0 ? 'var(--accent-pink)' : gain < 0 ? 'var(--accent-cyan)' : 'var(--text-muted)',
                            }}
                          >
                            {gain > 0 ? `+${gain.toFixed(1)} dB` : `${gain.toFixed(1)} dB`}
                          </span>
                        </div>

                        <input
                          type="range"
                          min={-24}
                          max={12}
                          step={0.5}
                          value={gain}
                          onChange={(e) => handleEqBandChange(idx, Number(e.target.value))}
                          style={{
                            width: '100%',
                            cursor: 'pointer',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

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
