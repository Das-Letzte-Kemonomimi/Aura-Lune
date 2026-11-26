import React, { useEffect, useId, useMemo, useState } from 'react';
import { invoke } from '../../api/ipc';
import {
  Activity,
  RotateCcw,
  Flame,
  Shield,
  Sparkles,
  Sliders,
  Check,
} from '../ui/icons';
import { getTranslations, type Language } from '../../i18n';
import { cn } from '../../utils/cn';
import { Button, ModalHeader, ModalShell } from '../ui';

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
  const loc = getTranslations(currentLang);
  const t = loc;

  const titleId = useId();
  const [state, setState] = useState<DynamicsState>(DEFAULT_STATE);
  const [presets, setPresets] = useState<DynamicsPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Fetch the initial state and the presets on open
  useEffect(() => {
    if (!isOpen) return;

    invoke<DynamicsState>('get_dynamics_state')
      .then((loaded) => {
        setState(loaded);
      })
      .catch((err) => {
        console.error('get_dynamics_state failed:', err);
      });

    invoke<DynamicsPreset[]>('get_dynamics_presets')
      .then((list) => {
        setPresets(list);
      })
      .catch((err) => {
        console.error('get_dynamics_presets failed:', err);
      });
  }, [isOpen]);

  // Apply the state to the audio engine in real time
  const applyState = async (newState: DynamicsState) => {
    setState(newState);
    try {
      await invoke('set_dynamics_state', { dynamicsState: newState });
    } catch (err) {
      console.error('set_dynamics_state failed:', err);
    }
  };

  // Preset change
  const handleSelectPreset = (preset: DynamicsPreset) => {
    setActivePresetId(preset.id);
    applyState(preset.state);
  };

  // Reset to a neutral bit-perfect bypass
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

  // SVG points for the dynamics compression curve
  // Input X: -60 dBFS .. 0 dBFS -> output Y: -60 dBFS .. +12 dBFS
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

      // Map dBFS to SVG coordinates
      // X: -60 dB = 0, 0 dB = effW
      const normX = (inputDb + 60) / 60;
      const svgX = padding + normX * effW;

      // Y: -60 dB = effH, 0 dB = padding + effH * 0.25 (leaves room for makeup gain up to +15dB)
      const maxRangeDb = 72; // from -60 to +12 dBFS
      const normY = Math.min(1.0, Math.max(0.0, (outputDb + 60) / maxRangeDb));
      const svgY = padding + effH * (1.0 - normY);

      points.push(`${svgX.toFixed(1)},${svgY.toFixed(1)}`);
    }

    return points.join(' ');
  }, [state.compressor]);

  // SVG points for the waveshaper saturation transfer curve
  // X: input -1.0 .. +1.0 -> Y: output -1.0 .. +1.0
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
    <ModalShell onClose={onClose} size="2xl" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={t.nav.dynamicsStudio}
        subtitle={loc.dynamicsStudio.subtitle}
        icon={<Activity size={20} />}
        onClose={onClose}
        closeLabel={loc.common.close}
        actions={
          <Button size="sm" onClick={handleReset} title={loc.dynamicsStudio.resetToBypass}>
            <RotateCcw size={14} /> {loc.dynamicsStudio.bypass}
          </Button>
        }
      />

      {/* QUICK PRESET LIST */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-white/5 bg-black/25 px-6 py-2.5">
        <span className="text-xs font-bold whitespace-nowrap text-accent-purple">
          <Sparkles size={14} className="mr-1 inline" />
          {loc.dynamicsStudio.presets}
        </span>
        {presets.map((p) => {
          const isSelected = activePresetId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => handleSelectPreset(p)}
              className={cn(
                'rounded-3xl border px-3 py-1.5 text-xs whitespace-nowrap transition-all duration-150',
                isSelected ? 'font-bold' : 'font-medium',
                isSelected ? 'bg-pink-500/30' : 'bg-white/4',
                isSelected ? 'border-pink-500' : 'border-white/10',
                isSelected ? 'text-fuchsia-50' : 'text-slate-300',
              )}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* MAIN CONTENT: 3 PANELS */}
      <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
        {/* RACK 1: DYNAMICS COMPRESSOR */}
        <div
          className={cn(
            'rounded-xl border bg-white/3 p-4 transition-all duration-200',
            state.compressor.enabled ? 'border-pink-500/45' : 'border-white/7',
            state.compressor.enabled ? 'shadow-halo-md shadow-pink-500/10' : 'shadow-none',
          )}
        >
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders size={18} className="text-pink-500" />
              <span className="text-md font-extrabold text-fuchsia-50">
                {loc.dynamicsStudio.drcTitle}
              </span>
              <span
                className={cn(
                  'rounded-xl px-2 py-0.5 text-xxs font-bold',
                  state.compressor.enabled ? 'bg-pink-500/20' : 'bg-white/5',
                  state.compressor.enabled ? 'text-pink-400' : 'text-fg-muted',
                )}
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
              className={cn(
                'flex items-center gap-1.5 rounded-3xl border-0 px-3.5 py-1.5 text-xs font-bold',
                state.compressor.enabled ? 'bg-pink-500' : 'bg-white/8',
                state.compressor.enabled ? 'text-fg' : 'text-fg-secondary',
              )}
            >
              {state.compressor.enabled ? <Check size={13} /> : null}
              {state.compressor.enabled ? loc.dynamicsStudio.enabled : loc.dynamicsStudio.bypass}
            </button>
          </div>

          <div className="grid grid-cols-[1fr_--spacing(70)] items-center gap-5">
            {/* COMPRESSOR SLIDERS */}
            <div className="flex flex-col gap-3">
              {/* Threshold */}
              <div>
                <div className="mb-1 flex justify-between text-ui">
                  <span className="text-slate-300">{loc.dynamicsStudio.threshold}</span>
                  <span className="font-bold text-pink-400">
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
                  className="w-full cursor-pointer accent-pink-500"
                />
              </div>

              {/* Ratio & Presets */}
              <div>
                <div className="mb-1 flex justify-between text-ui">
                  <span className="text-slate-300">{loc.dynamicsStudio.ratio}</span>
                  <span className="font-bold text-pink-400">
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
                  className="w-full cursor-pointer accent-pink-500"
                />
                <div className="mt-1.5 flex gap-1.5">
                  {[1.5, 2.0, 3.0, 4.0, 8.0, 20.0].map((r) => (
                    <button
                      key={r}
                      onClick={() =>
                        applyState({
                          ...state,
                          compressor: { ...state.compressor, ratio: r },
                        })
                      }
                      className={cn(
                        'flex-1 rounded-md border px-0 py-1 text-xxs',
                        Math.abs(state.compressor.ratio - r) < 0.1 ? 'bg-pink-500/25' : 'bg-white/4',
                        Math.abs(state.compressor.ratio - r) < 0.1 ? 'border-pink-500' : 'border-white/8',
                        Math.abs(state.compressor.ratio - r) < 0.1 ? 'text-fuchsia-50' : 'text-fg-secondary',
                      )}
                    >
                      {r === 20 ? 'Limit' : `${r}:1`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Soft-Knee & Makeup Gain */}
              <div className="grid grid-cols-[--spacing(30)_1fr] items-center gap-4">
                <div>
                  <span className="mb-1 block text-ui text-slate-300">
                    {loc.dynamicsStudio.knee}
                  </span>
                  <button
                    onClick={() =>
                      applyState({
                        ...state,
                        compressor: { ...state.compressor, soft_knee: !state.compressor.soft_knee },
                      })
                    }
                    className={cn(
                      'w-full rounded-lg border px-2 py-1.5 text-xs font-bold',
                      state.compressor.soft_knee ? 'bg-pink-500/20' : 'bg-white/5',
                      state.compressor.soft_knee ? 'border-pink-500' : 'border-white/10',
                      state.compressor.soft_knee ? 'text-pink-400' : 'text-fg-secondary',
                    )}
                  >
                    {state.compressor.soft_knee ? 'Soft Knee' : 'Hard Knee'}
                  </button>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-ui">
                    <span className="text-slate-300">{loc.dynamicsStudio.makeup}</span>
                    <span className="font-bold text-pink-400">
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
                    className="w-full cursor-pointer accent-pink-500"
                  />
                </div>
              </div>
            </div>

            {/* SVG COMPRESSION CURVE CHART */}
            <div className="flex flex-col items-center rounded-xl border border-white/8 bg-black/40 p-2">
              <div className="mb-1 w-full text-left text-xxs text-fg-secondary">
                {loc.dynamicsStudio.inputOutputCurve}
              </div>
              <svg width="280" height="140" className="overflow-visible">
                {/* Background grid */}
                <line x1="10" y1="130" x2="270" y2="130" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <line x1="10" y1="10" x2="10" y2="130" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                {/* Straight 1:1 line without compression (grey, dashed) */}
                <line x1="10" y1="130" x2="270" y2="40" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                {/* Dynamic compressor curve */}
                <polyline
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="2.5"
                  points={compressionCurvePoints}
                />
              </svg>
              <div className="mt-1 flex w-full justify-between text-xxs text-fg-muted">
                <span>-60 dB</span>
                <span>-30 dB</span>
                <span>0 dBFS</span>
              </div>
            </div>
          </div>
        </div>

        {/* RACK 2: ANALOG SATURATOR & TUBE */}
        <div
          className={cn(
            'rounded-xl border bg-white/3 p-4 transition-all duration-200',
            state.saturator.enabled && state.saturator.mode !== 'Off' ? 'border-accent-amber/45' : 'border-white/7',
            state.saturator.enabled && state.saturator.mode !== 'Off' ? 'shadow-halo-md shadow-accent-amber/10' : 'shadow-none',
          )}
        >
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-accent-amber" />
              <span className="text-md font-extrabold text-fuchsia-50">
                {loc.dynamicsStudio.saturatorTitle}
              </span>
              <span
                className={cn(
                  'rounded-xl px-2 py-0.5 text-xxs font-bold',
                  state.saturator.enabled && state.saturator.mode !== 'Off' ? 'bg-accent-amber/20' : 'bg-white/5',
                  state.saturator.enabled && state.saturator.mode !== 'Off' ? 'text-amber-400' : 'text-fg-muted',
                )}
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
              className={cn(
                'flex items-center gap-1.5 rounded-3xl border-0 px-3.5 py-1.5 text-xs font-bold',
                state.saturator.enabled ? 'bg-accent-amber' : 'bg-white/8',
                state.saturator.enabled ? 'text-fg' : 'text-fg-secondary',
              )}
            >
              {state.saturator.enabled ? <Check size={13} /> : null}
              {state.saturator.enabled ? loc.dynamicsStudio.enabled : loc.dynamicsStudio.bypass}
            </button>
          </div>

          {/* Saturation mode choice */}
          <div className="mb-4 flex gap-2">
            {[
              { id: 'TubeWarmth' as SaturatorMode, label: loc.dynamicsStudio.modeTube, desc: loc.dynamicsStudio.modeTubeDesc },
              { id: 'TapeSaturation' as SaturatorMode, label: loc.dynamicsStudio.modeTape, desc: loc.dynamicsStudio.modeTapeDesc },
              { id: 'Overdrive' as SaturatorMode, label: loc.dynamicsStudio.modeOverdrive, desc: loc.dynamicsStudio.modeOverdriveDesc },
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
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-left transition-all duration-150',
                    isCurrent ? 'bg-accent-amber/25' : 'bg-white/4',
                    isCurrent ? 'border-accent-amber' : 'border-white/8',
                  )}
                  style={{ color: isCurrent ? '#fef3c7' : '#cbd5e1' }}
                >
                  <div className="text-ui font-bold">{m.label}</div>
                  <div className={cn('text-xxs', isCurrent ? 'text-amber-200' : 'text-fg-muted')}>{m.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-[1fr_--spacing(70)] items-center gap-5">
            {/* SATURATOR SLIDERS */}
            <div className="flex flex-col gap-3">
              {/* Drive */}
              <div>
                <div className="mb-1 flex justify-between text-ui">
                  <span className="text-slate-300">{loc.dynamicsStudio.drive}</span>
                  <span className="font-bold text-amber-400">
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
                  className="w-full cursor-pointer accent-accent-amber"
                />
              </div>

              {/* Warmth (TubeWarmth only) */}
              {state.saturator.mode === 'TubeWarmth' && (
                <div>
                  <div className="mb-1 flex justify-between text-ui">
                    <span className="text-slate-300">
                      {loc.dynamicsStudio.evenHarmonics}
                    </span>
                    <span className="font-bold text-amber-400">
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
                    className="w-full cursor-pointer accent-accent-amber"
                  />
                </div>
              )}

              {/* Dry/Wet Mix */}
              <div>
                <div className="mb-1 flex justify-between text-ui">
                  <span className="text-slate-300">{loc.dynamicsStudio.dryWet}</span>
                  <span className="font-bold text-amber-400">
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
                  className="w-full cursor-pointer accent-accent-amber"
                />
              </div>
            </div>

            {/* WAVESHAPER CURVE CHART */}
            <div className="flex flex-col items-center rounded-xl border border-white/8 bg-black/40 p-2">
              <div className="mb-1 w-full text-left text-xxs text-fg-secondary">
                {loc.dynamicsStudio.waveshaperCurve}
              </div>
              <svg width="280" height="140" className="overflow-visible">
                {/* Axes x = 0 and y = 0 */}
                <line x1="10" y1="70" x2="270" y2="70" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <line x1="140" y1="10" x2="140" y2="130" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                {/* Neutral linear line (grey, dashed) */}
                <line x1="10" y1="130" x2="270" y2="10" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                {/* Dynamic saturation curve */}
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  points={waveshaperCurvePoints}
                />
              </svg>
              <div className="mt-1 flex w-full justify-between text-xxs text-fg-muted">
                <span>-1.0</span>
                <span>0.0</span>
                <span>+1.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* RACK 3: HEADPHONE MASTER LIMITER */}
        <div
          className={cn(
            'flex items-center justify-between rounded-xl border bg-white/3 p-4',
            state.limiter.enabled ? 'border-blue-500/40' : 'border-white/7',
            state.limiter.enabled ? 'shadow-halo-md shadow-blue-500/10' : 'shadow-none',
          )}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/50 bg-blue-500/20 text-blue-400"
            >
              <Shield size={20} />
            </div>
            <div>
              <div className="text-md font-extrabold text-fuchsia-50">
                {loc.dynamicsStudio.limiterTitle}
              </div>
              <div className="text-xs text-fg-secondary">
                {loc.dynamicsStudio.limiterDesc}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-blue-400">
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
              className={cn(
                'flex items-center gap-1.5 rounded-3xl border-0 px-3.5 py-1.5 text-xs font-bold',
                state.limiter.enabled ? 'bg-blue-500' : 'bg-white/8',
                state.limiter.enabled ? 'text-fg' : 'text-fg-secondary',
              )}
            >
              {state.limiter.enabled ? <Check size={13} /> : null}
              {state.limiter.enabled ? loc.dynamicsStudio.active : loc.dynamicsStudio.off}
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between border-t border-white/8 bg-black/20 px-6 py-3">
        <div className="text-xs text-fg-muted">
          {loc.dynamicsStudio.realTimeTip}
        </div>

        <button
          onClick={onClose}
          className="rounded-lg border-0 bg-linear-to-r from-pink-500 to-accent-purple px-5 py-2 text-ui font-bold text-fg shadow-lift shadow-pink-500/30"
        >
          {loc.dynamicsStudio.done}
        </button>
      </div>
    </ModalShell>
  );
};
