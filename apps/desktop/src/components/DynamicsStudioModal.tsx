import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity,
  X,
  RotateCcw,
  Flame,
  Shield,
  Sparkles,
  Sliders,
  Check,
} from 'lucide-react';
import { translations, type Language } from '../i18n';

export type SaturatorMode = 'Off' | 'TubeWarmth' | 'TapeSaturation' | 'Overdrive';

export interface CompressorConfig {
  enabled: boolean;
  threshold_db: number;
  ratio: number;
  soft_knee: boolean;
  makeup_gain_db: number;
}

export interface SaturatorConfig {
  enabled: boolean;
  mode: SaturatorMode;
  drive: number;
  warmth: number;
  mix: number;
}

export interface LimiterConfig {
  enabled: boolean;
  ceiling_db: number;
}

export interface DynamicsState {
  compressor: CompressorConfig;
  saturator: SaturatorConfig;
  limiter: LimiterConfig;
}

export interface DynamicsPreset {
  id: string;
  name: string;
  description: string;
  state: DynamicsState;
}

interface DynamicsStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang?: Language;
}

const DEFAULT_STATE: DynamicsState = {
  compressor: {
    enabled: false,
    threshold_db: -18.0,
    ratio: 3.0,
    soft_knee: true,
    makeup_gain_db: 3.0,
  },
  saturator: {
    enabled: false,
    mode: 'TubeWarmth',
    drive: 1.5,
    warmth: 0.5,
    mix: 0.75,
  },
  limiter: {
    enabled: true,
    ceiling_db: -0.2,
  },
};

export const DynamicsStudioModal: React.FC<DynamicsStudioModalProps> = ({
  isOpen,
  onClose,
  currentLang = 'pl',
}) => {
  const t = translations[currentLang] || translations.pl;
  const isPl = currentLang === 'pl';

  const [state, setState] = useState<DynamicsState>(DEFAULT_STATE);
  const [presets, setPresets] = useState<DynamicsPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Pobierz stan początkowy oraz presety przy otwarciu
  useEffect(() => {
    if (!isOpen) return;

    invoke<DynamicsState>('get_dynamics_state')
      .then((loaded) => {
        setState(loaded);
      })
      .catch((err) => {
        console.error('Błąd get_dynamics_state:', err);
      });

    invoke<DynamicsPreset[]>('get_dynamics_presets')
      .then((list) => {
        setPresets(list);
      })
      .catch((err) => {
        console.error('Błąd get_dynamics_presets:', err);
      });
  }, [isOpen]);

  // Aplikuj stan do silnika audio w czasie rzeczywistym
  const applyState = async (newState: DynamicsState) => {
    setState(newState);
    try {
      await invoke('set_dynamics_state', { dynamicsState: newState });
    } catch (err) {
      console.error('Błąd set_dynamics_state:', err);
    }
  };

  // Obsługa zmiany presetu
  const handleSelectPreset = (preset: DynamicsPreset) => {
    setActivePresetId(preset.id);
    applyState(preset.state);
  };

  // Reset do neutralnego bit-perfect bypass
  const handleReset = () => {
    setActivePresetId('bypass');
    applyState({
      compressor: {
        enabled: false,
        threshold_db: -18.0,
        ratio: 3.0,
        soft_knee: true,
        makeup_gain_db: 0.0,
      },
      saturator: {
        enabled: false,
        mode: 'Off',
        drive: 1.0,
        warmth: 0.0,
        mix: 0.0,
      },
      limiter: {
        enabled: true,
        ceiling_db: -0.2,
      },
    });
  };

  // Wyliczanie punktów SVG dla krzywej kompresji dynamiki
  // Wejście X: -60 dBFS .. 0 dBFS -> Wyjście Y: -60 dBFS .. +12 dBFS
  const compressionCurvePoints = useMemo(() => {
    const width = 280;
    const height = 140;
    const padding = 10;
    const effW = width - padding * 2;
    const effH = height - padding * 2;

    const thresh = state.compressor.threshold_db;
    const ratio = Math.max(1.0, state.compressor.ratio);
    const makeup = state.compressor.enabled ? state.compressor.makeup_gain_db : 0;
    const isSoft = state.compressor.soft_knee;

    const points: string[] = [];
    const steps = 60;

    for (let i = 0; i <= steps; i++) {
      const inputDb = -60 + (i / steps) * 60; // -60 to 0 dBFS
      let outputDb = inputDb;

      if (state.compressor.enabled) {
        if (!isSoft) {
          // Hard knee
          if (inputDb > thresh) {
            outputDb = thresh + (inputDb - thresh) / ratio;
          }
        } else {
          // Soft knee (2 * kneeWidth dB transition window)
          const knee = 6;
          if (inputDb < thresh - knee) {
            outputDb = inputDb;
          } else if (inputDb > thresh + knee) {
            outputDb = thresh + (inputDb - thresh) / ratio;
          } else {
            // Quadratic interpolation
            const diff = inputDb - thresh + knee;
            outputDb = inputDb + ((1 / ratio - 1) * (diff * diff)) / (4 * knee);
          }
        }
        outputDb += makeup;
      }

      // Mapowanie dBFS do współrzędnych SVG
      // X: -60 dB = 0, 0 dB = effW
      const normX = (inputDb + 60) / 60;
      const svgX = padding + normX * effW;

      // Y: -60 dB = effH, 0 dB = padding + effH * 0.25 (zostawiamy miejsce na makeup gain do +15dB)
      const maxRangeDb = 72; // od -60 do +12 dBFS
      const normY = Math.min(1.0, Math.max(0.0, (outputDb + 60) / maxRangeDb));
      const svgY = padding + effH * (1.0 - normY);

      points.push(`${svgX.toFixed(1)},${svgY.toFixed(1)}`);
    }

    return points.join(' ');
  }, [state.compressor]);

  // Wyliczanie punktów SVG dla krzywej transferu nasycenia falowego (waveshaper)
  // X: wejście -1.0 .. +1.0 -> Y: wyjście -1.0 .. +1.0
  const waveshaperCurvePoints = useMemo(() => {
    const width = 280;
    const height = 140;
    const padding = 10;
    const effW = width - padding * 2;
    const effH = height - padding * 2;

    const sat = state.saturator;
    const drive = Math.max(1.0, Math.min(5.0, sat.drive));
    const warmth = Math.max(0.0, Math.min(1.0, sat.warmth));
    const mix = sat.enabled && sat.mode !== 'Off' ? sat.mix : 0;

    const points: string[] = [];
    const steps = 60;

    for (let i = 0; i <= steps; i++) {
      const x = -1.0 + (i / steps) * 2.0;
      let saturated = x;

      if (sat.mode === 'TapeSaturation') {
        const xd = x * drive;
        const norm = (2.0 / Math.PI) * Math.atan(xd);
        saturated = norm / (1.0 + 0.1 * drive);
      } else if (sat.mode === 'TubeWarmth') {
        const xd = x * drive;
        const asym =
          xd >= 0
            ? xd / (1.0 + xd * (0.4 + 0.3 * warmth))
            : xd / (1.0 - xd * (0.2 + 0.1 * warmth));
        saturated = asym / (1.0 + 0.15 * drive);
      } else if (sat.mode === 'Overdrive') {
        const xd = x * drive;
        saturated = Math.tanh(xd) / Math.max(1.0, drive * 0.4);
      }

      const out = (1.0 - mix) * x + mix * saturated;

      // X: [-1, 1] -> [padding, padding + effW]
      const svgX = padding + ((x + 1.0) / 2.0) * effW;
      // Y: [-1, 1] -> [padding + effH, padding]
      const clampedOut = Math.max(-1.1, Math.min(1.1, out));
      const svgY = padding + ((1.0 - clampedOut) / 2.0) * effH;

      points.push(`${svgX.toFixed(1)},${svgY.toFixed(1)}`);
    }

    return points.join(' ');
  }, [state.saturator]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          backgroundColor: 'rgba(18, 16, 26, 0.94)',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(236, 72, 153, 0.15)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f3e8ff',
        }}
      >
        {/* NAGŁÓWEK */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.12), rgba(168, 85, 247, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'rgba(236, 72, 153, 0.2)',
                border: '1px solid rgba(236, 72, 153, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f472b6',
              }}
            >
              <Activity size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fdf4ff' }}>
                {t.nav.dynamicsStudio}
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1' }}>
                {isPl
                  ? 'Kompresor dynamiki, nasycenie taśmowe, ciepło lampowe i limiter'
                  : 'Dynamic Range Compressor, Tape & Tube Saturation, Headphone Limiter'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleReset}
              title={isPl ? 'Przywróć stan neutralny (Bypass)' : 'Reset to Bypass'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={14} /> {isPl ? 'Bypass' : 'Bypass'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* LISTA SZYBKICH PRESETÓW */}
        <div
          style={{
            padding: '10px 24px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a855f7', whiteSpace: 'nowrap' }}>
            <Sparkles size={14} style={{ display: 'inline', marginRight: 4 }} />
            {isPl ? 'Presety:' : 'Presets:'}
          </span>
          {presets.map((p) => {
            const isSelected = activePresetId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '0.74rem',
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? 'rgba(236, 72, 153, 0.3)' : 'rgba(255, 255, 255, 0.04)',
                  border: isSelected ? '1px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: isSelected ? '#fdf4ff' : '#cbd5e1',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        {/* ZAWARTOŚĆ GŁÓWNA - 3 PANELE */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* RACK 1: KOMPRESOR DYNAMIKI */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.025)',
              border: state.compressor.enabled
                ? '1px solid rgba(236, 72, 153, 0.45)'
                : '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: state.compressor.enabled ? '0 0 15px rgba(236, 72, 153, 0.12)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="#ec4899" />
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fdf4ff' }}>
                  {isPl ? 'Kompresor Dynamiki (DRC)' : 'Dynamic Range Compressor'}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: state.compressor.enabled
                      ? 'rgba(236, 72, 153, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: state.compressor.enabled ? '#f472b6' : '#64748b',
                    fontWeight: 700,
                  }}
                >
                  {state.compressor.enabled ? 'ACTIVE' : 'BYPASS'}
                </span>
              </div>

              <button
                onClick={() =>
                  applyState({
                    ...state,
                    compressor: { ...state.compressor, enabled: !state.compressor.enabled },
                  })
                }
                style={{
                  padding: '5px 14px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: state.compressor.enabled ? '#ec4899' : 'rgba(255, 255, 255, 0.08)',
                  color: state.compressor.enabled ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {state.compressor.enabled ? <Check size={13} /> : null}
                {state.compressor.enabled ? (isPl ? 'Włączony' : 'Enabled') : isPl ? 'Wyłączony' : 'Bypass'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px', alignItems: 'center' }}>
              {/* SUWAKI KOMPRESORA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Threshold */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                    <span style={{ color: '#cbd5e1' }}>{isPl ? 'Próg (Threshold):' : 'Threshold:'}</span>
                    <span style={{ fontWeight: 700, color: '#f472b6' }}>
                      {state.compressor.threshold_db.toFixed(1)} dBFS
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-60}
                    max={0}
                    step={0.5}
                    value={state.compressor.threshold_db}
                    onChange={(e) =>
                      applyState({
                        ...state,
                        compressor: { ...state.compressor, threshold_db: parseFloat(e.target.value) },
                      })
                    }
                    style={{ width: '100%', accentColor: '#ec4899', cursor: 'pointer' }}
                  />
                </div>

                {/* Ratio & Presets */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                    <span style={{ color: '#cbd5e1' }}>{isPl ? 'Stosunek (Ratio):' : 'Ratio:'}</span>
                    <span style={{ fontWeight: 700, color: '#f472b6' }}>
                      {state.compressor.ratio.toFixed(1)} : 1
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={0.1}
                    value={state.compressor.ratio}
                    onChange={(e) =>
                      applyState({
                        ...state,
                        compressor: { ...state.compressor, ratio: parseFloat(e.target.value) },
                      })
                    }
                    style={{ width: '100%', accentColor: '#ec4899', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: 6 }}>
                    {[1.5, 2.0, 3.0, 4.0, 8.0, 20.0].map((r) => (
                      <button
                        key={r}
                        onClick={() =>
                          applyState({
                            ...state,
                            compressor: { ...state.compressor, ratio: r },
                          })
                        }
                        style={{
                          flex: 1,
                          padding: '3px 0',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          background:
                            Math.abs(state.compressor.ratio - r) < 0.1
                              ? 'rgba(236, 72, 153, 0.25)'
                              : 'rgba(255, 255, 255, 0.04)',
                          border:
                            Math.abs(state.compressor.ratio - r) < 0.1
                              ? '1px solid #ec4899'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                          color: Math.abs(state.compressor.ratio - r) < 0.1 ? '#fdf4ff' : '#94a3b8',
                          cursor: 'pointer',
                        }}
                      >
                        {r === 20 ? 'Limit' : `${r}:1`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Soft-Knee & Makeup Gain */}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'block', marginBottom: 4 }}>
                      {isPl ? 'Kolano (Knee):' : 'Knee:'}
                    </span>
                    <button
                      onClick={() =>
                        applyState({
                          ...state,
                          compressor: { ...state.compressor, soft_knee: !state.compressor.soft_knee },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: state.compressor.soft_knee
                          ? 'rgba(236, 72, 153, 0.2)'
                          : 'rgba(255, 255, 255, 0.05)',
                        border: state.compressor.soft_knee
                          ? '1px solid #ec4899'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        color: state.compressor.soft_knee ? '#f472b6' : '#94a3b8',
                        cursor: 'pointer',
                      }}
                    >
                      {state.compressor.soft_knee ? 'Soft Knee' : 'Hard Knee'}
                    </button>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                      <span style={{ color: '#cbd5e1' }}>{isPl ? 'Wzmocnienie (Makeup):' : 'Makeup Gain:'}</span>
                      <span style={{ fontWeight: 700, color: '#f472b6' }}>
                        +{state.compressor.makeup_gain_db.toFixed(1)} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={0.5}
                      value={state.compressor.makeup_gain_db}
                      onChange={(e) =>
                        applyState({
                          ...state,
                          compressor: { ...state.compressor, makeup_gain_db: parseFloat(e.target.value) },
                        })
                      }
                      style={{ width: '100%', accentColor: '#ec4899', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

              {/* WYKRES KRZYWEJ KOMPRESJI SVG */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: 4, width: '100%', textAlign: 'left' }}>
                  {isPl ? 'Charakterystyka wejście/wyjście (dBFS):' : 'Input/Output curve (dBFS):'}
                </div>
                <svg width="280" height="140" style={{ overflow: 'visible' }}>
                  {/* Siatka tła */}
                  <line x1="10" y1="130" x2="270" y2="130" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <line x1="10" y1="10" x2="10" y2="130" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  {/* Linia prosta 1:1 bez kompresji (szara przerywana) */}
                  <line x1="10" y1="130" x2="270" y2="40" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                  {/* Dynamiczna krzywa kompresora */}
                  <polyline
                    fill="none"
                    stroke="#ec4899"
                    strokeWidth="2.5"
                    points={compressionCurvePoints}
                  />
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.65rem', color: '#64748b', marginTop: 4 }}>
                  <span>-60 dB</span>
                  <span>-30 dB</span>
                  <span>0 dBFS</span>
                </div>
              </div>
            </div>
          </div>

          {/* RACK 2: SATURATOR ANALOGOWY & LAMPA */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.025)',
              border: state.saturator.enabled && state.saturator.mode !== 'Off'
                ? '1px solid rgba(245, 158, 11, 0.45)'
                : '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: state.saturator.enabled && state.saturator.mode !== 'Off' ? '0 0 15px rgba(245, 158, 11, 0.12)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={18} color="#f59e0b" />
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fdf4ff' }}>
                  {isPl ? 'Saturator Analogowy & Ciepło Lampy' : 'Analog Tube & Tape Saturation'}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: state.saturator.enabled && state.saturator.mode !== 'Off'
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: state.saturator.enabled && state.saturator.mode !== 'Off' ? '#fbbf24' : '#64748b',
                    fontWeight: 700,
                  }}
                >
                  {state.saturator.enabled && state.saturator.mode !== 'Off' ? state.saturator.mode.toUpperCase() : 'BYPASS'}
                </span>
              </div>

              <button
                onClick={() =>
                  applyState({
                    ...state,
                    saturator: {
                      ...state.saturator,
                      enabled: !state.saturator.enabled,
                      mode: !state.saturator.enabled && state.saturator.mode === 'Off' ? 'TubeWarmth' : state.saturator.mode,
                    },
                  })
                }
                style={{
                  padding: '5px 14px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: state.saturator.enabled ? '#f59e0b' : 'rgba(255, 255, 255, 0.08)',
                  color: state.saturator.enabled ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {state.saturator.enabled ? <Check size={13} /> : null}
                {state.saturator.enabled ? (isPl ? 'Włączony' : 'Enabled') : isPl ? 'Wyłączony' : 'Bypass'}
              </button>
            </div>

            {/* Wybór trybu saturacji */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[
                { id: 'TubeWarmth' as SaturatorMode, label: isPl ? 'Lampa (Trioda)' : 'Tube Warmth', desc: 'Ciepłe parzyste harmoniczne' },
                { id: 'TapeSaturation' as SaturatorMode, label: isPl ? 'Taśma Magnetofonowa' : 'Tape Deck', desc: 'Gęsty bas, łagodna góra' },
                { id: 'Overdrive' as SaturatorMode, label: isPl ? 'Overdrive Harmoniczny' : 'Overdrive', desc: 'Mocniejsze nasycenie lo-fi' },
              ].map((m) => {
                const isCurrent = state.saturator.mode === m.id && state.saturator.enabled;
                return (
                  <button
                    key={m.id}
                    onClick={() =>
                      applyState({
                        ...state,
                        saturator: { ...state.saturator, mode: m.id, enabled: true },
                      })
                    }
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: isCurrent ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      border: isCurrent ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: isCurrent ? '#fef3c7' : '#cbd5e1',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{m.label}</div>
                    <div style={{ fontSize: '0.68rem', color: isCurrent ? '#fde68a' : '#64748b' }}>{m.desc}</div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px', alignItems: 'center' }}>
              {/* SUWAKI SATURATORA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Drive */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                    <span style={{ color: '#cbd5e1' }}>{isPl ? 'Wysterowanie (Drive):' : 'Drive:'}</span>
                    <span style={{ fontWeight: 700, color: '#fbbf24' }}>
                      {state.saturator.drive.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={5.0}
                    step={0.05}
                    value={state.saturator.drive}
                    onChange={(e) =>
                      applyState({
                        ...state,
                        saturator: { ...state.saturator, drive: parseFloat(e.target.value) },
                      })
                    }
                    style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                </div>

                {/* Warmth (tylko dla TubeWarmth) */}
                {state.saturator.mode === 'TubeWarmth' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                      <span style={{ color: '#cbd5e1' }}>
                        {isPl ? 'Ciepło / 2. Harmoniczna (Asymetria):' : 'Even Harmonic Warmth:'}
                      </span>
                      <span style={{ fontWeight: 700, color: '#fbbf24' }}>
                        {Math.round(state.saturator.warmth * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={state.saturator.warmth}
                      onChange={(e) =>
                        applyState({
                          ...state,
                          saturator: { ...state.saturator, warmth: parseFloat(e.target.value) },
                        })
                      }
                      style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                    />
                  </div>
                )}

                {/* Dry/Wet Mix */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                    <span style={{ color: '#cbd5e1' }}>{isPl ? 'Miks nasycenia (Dry / Wet):' : 'Dry / Wet Mix:'}</span>
                    <span style={{ fontWeight: 700, color: '#fbbf24' }}>
                      {Math.round(state.saturator.mix * 100)}% Wet
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={state.saturator.mix}
                    onChange={(e) =>
                      applyState({
                        ...state,
                        saturator: { ...state.saturator, mix: parseFloat(e.target.value) },
                      })
                    }
                    style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* WYKRES KRZYWEJ FALOWEJ WSUWAKÓW */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: 4, width: '100%', textAlign: 'left' }}>
                  {isPl ? 'Krzywa nasycenia f(x) [-1 .. +1]:' : 'Waveshaper curve f(x):'}
                </div>
                <svg width="280" height="140" style={{ overflow: 'visible' }}>
                  {/* Osie x = 0 i y = 0 */}
                  <line x1="10" y1="70" x2="270" y2="70" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                  <line x1="140" y1="10" x2="140" y2="130" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                  {/* Linia neutralna liniowa (szara przerywana) */}
                  <line x1="10" y1="130" x2="270" y2="10" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                  {/* Dynamiczna krzywa nasycenia */}
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    points={waveshaperCurvePoints}
                  />
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.65rem', color: '#64748b', marginTop: 4 }}>
                  <span>-1.0</span>
                  <span>0.0</span>
                  <span>+1.0</span>
                </div>
              </div>
            </div>
          </div>

          {/* RACK 3: MASTER LIMITER SŁUCHAWKOWY */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.025)',
              border: state.limiter.enabled
                ? '1px solid rgba(59, 130, 246, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: state.limiter.enabled ? '0 0 15px rgba(59, 130, 246, 0.1)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#60a5fa',
                }}
              >
                <Shield size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fdf4ff' }}>
                  {isPl ? 'Limiter Słuchawkowy (True-Peak Limiter)' : 'Headphone True-Peak Limiter'}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  {isPl
                    ? 'Blokuje przesterowanie 0 dBFS i chroni słuch przed nagłymi skokami głośności'
                    : 'Hard ceiling protection against digital clipping and hearing fatigue'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa' }}>
                Ceiling: {state.limiter.ceiling_db.toFixed(1)} dBFS
              </span>
              <button
                onClick={() => {
                  const newLim = !state.limiter.enabled;
                  applyState({
                    ...state,
                    limiter: { ...state.limiter, enabled: newLim },
                  });
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: state.limiter.enabled ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
                  color: state.limiter.enabled ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {state.limiter.enabled ? <Check size={13} /> : null}
                {state.limiter.enabled ? (isPl ? 'Aktywny' : 'Active') : isPl ? 'Wyłączony' : 'Off'}
              </button>
            </div>
          </div>
        </div>

        {/* STOPKA */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {isPl
              ? 'Wszystkie parametry dynamiki i nasycenia są aplikowane w czasie rzeczywistym w potoku GStreamera'
              : 'All dynamics and saturation stages apply real-time inside GStreamer engine'}
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: 'linear-gradient(90deg, #ec4899, #a855f7)',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)',
            }}
          >
            {isPl ? 'Gotowe' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
