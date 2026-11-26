import React, { useEffect, useId, useMemo, useState } from 'react';
import { invoke } from '../../api/ipc';
import { Activity, RotateCcw, Flame, Shield, Sparkles, Sliders } from '../ui/icons';
import { getTranslations, type Language } from '../../i18n';
import {
  Badge,
  Button,
  Card,
  Chip,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  OptionCard,
  SliderRow,
  ToggleCard,
  type Tone,
} from '../ui';
import { textTones } from '../ui/tones';
import { presetDescription, presetLabel } from '../../utils/dspPresetLabels';

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


const RATIO_PRESETS = [1.5, 2, 3, 4, 8, 20] as const;

/** Transfer curve preview (280 × 140) with its title and three axis labels. `children` draws the grid. */
function CurveChart({
  title,
  tone,
  points,
  axisLabels,
  children,
}: {
  title: string;
  tone: Tone;
  points: string;
  axisLabels: readonly [string, string, string];
  children: React.ReactNode;
}) {
  return (
    <Card variant="inset" padding="none" className="flex flex-col items-center p-2">
      <div className="mb-1 w-full text-left text-xxs text-fg-secondary">{title}</div>
      <svg width="280" height="140" className="overflow-visible text-fg" aria-hidden="true">
        {children}
        <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={points} className={textTones[tone]} />
      </svg>
      <div className="mt-1 flex w-full justify-between text-xxs text-fg-muted">
        {axisLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </Card>
  );
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
        if (loaded) setState(loaded);
      })
      .catch((err) => {
        console.error('get_dynamics_state failed:', err);
      });

    invoke<DynamicsPreset[]>('get_dynamics_presets')
      .then((list) => {
        setPresets(list ?? []);
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

  const setCompressor = (patch: Partial<CompressorConfig>) =>
    applyState({ ...state, compressor: { ...state.compressor, ...patch } });
  const setSaturator = (patch: Partial<SaturatorConfig>) =>
    applyState({ ...state, saturator: { ...state.saturator, ...patch } });
  const saturatorOn = state.saturator.enabled && state.saturator.mode !== 'Off';
  const saturatorModes = [
    { id: 'TubeWarmth', label: loc.dynamicsStudio.modeTube, desc: loc.dynamicsStudio.modeTubeDesc },
    { id: 'TapeSaturation', label: loc.dynamicsStudio.modeTape, desc: loc.dynamicsStudio.modeTapeDesc },
    { id: 'Overdrive', label: loc.dynamicsStudio.modeOverdrive, desc: loc.dynamicsStudio.modeOverdriveDesc },
  ] as const satisfies readonly { id: SaturatorMode; label: string; desc: string }[];

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

      {/* Presets */}
      <div
        role="group"
        aria-labelledby={`${titleId}-presets`}
        className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line bg-black/25 px-6 py-2.5"
      >
        <span id={`${titleId}-presets`} className="flex shrink-0 items-center gap-1 text-xs font-bold text-accent-purple">
          <Sparkles size={14} />
          {loc.dynamicsStudio.presets}
        </span>
        {presets.map((p) => (
          <Chip
            key={p.id}
            pressed={activePresetId === p.id}
            onClick={() => handleSelectPreset(p)}
            title={presetDescription(loc, 'dynamics', p.id, p.description)}
            className="shrink-0 rounded-full"
          >
            {presetLabel(loc, 'dynamics', p.id, p.name)}
          </Chip>
        ))}
      </div>

      <ModalBody className="flex flex-col gap-5">
        {/* Dynamic range compressor */}
        <ToggleCard
          icon={<Sliders size={18} />}
          tone="pink"
          title={loc.dynamicsStudio.drcTitle}
          badges={<Badge tone={state.compressor.enabled ? 'pink' : 'neutral'} size="xs">{state.compressor.enabled ? 'ACTIVE' : 'BYPASS'}</Badge>}
          checked={state.compressor.enabled}
          onChange={(on) => setCompressor({ enabled: on })}
        >
          <div className="grid grid-cols-[1fr_--spacing(70)] items-center gap-5">
            <div className="flex flex-col gap-3">
              <SliderRow
                label={loc.dynamicsStudio.threshold}
                min={-60}
                max={0}
                step={0.5}
                value={state.compressor.threshold_db}
                format={(v) => `${v.toFixed(1)} dBFS`}
                onChange={(v) => setCompressor({ threshold_db: v })}
              />
              <div>
                <SliderRow
                  label={loc.dynamicsStudio.ratio}
                  min={1}
                  max={20}
                  step={0.1}
                  value={state.compressor.ratio}
                  format={(v) => `${v.toFixed(1)} : 1`}
                  onChange={(v) => setCompressor({ ratio: v })}
                />
                <div className="mt-1.5 flex gap-1.5">
                  {RATIO_PRESETS.map((r) => (
                    <Chip
                      key={r}
                      size="xs"
                      pressed={Math.abs(state.compressor.ratio - r) < 0.1}
                      onClick={() => setCompressor({ ratio: r })}
                      className="flex-1 justify-center"
                    >
                      {r === 20 ? 'Limit' : `${r}:1`}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-[--spacing(30)_1fr] items-end gap-4">
                <div>
                  <span id={`${titleId}-knee`} className="mb-1 block text-xs font-semibold text-fg-secondary">
                    {loc.dynamicsStudio.knee}
                  </span>
                  <Chip
                    aria-describedby={`${titleId}-knee`}
                    pressed={state.compressor.soft_knee}
                    onClick={() => setCompressor({ soft_knee: !state.compressor.soft_knee })}
                    className="w-full justify-center"
                  >
                    {state.compressor.soft_knee ? 'Soft Knee' : 'Hard Knee'}
                  </Chip>
                </div>
                <SliderRow
                  label={loc.dynamicsStudio.makeup}
                  min={0}
                  max={24}
                  step={0.5}
                  value={state.compressor.makeup_gain_db}
                  format={(v) => `+${v.toFixed(1)} dB`}
                  onChange={(v) => setCompressor({ makeup_gain_db: v })}
                />
              </div>
            </div>

            <CurveChart
              title={loc.dynamicsStudio.inputOutputCurve}
              tone="pink"
              points={compressionCurvePoints}
              axisLabels={['-60 dB', '-30 dB', '0 dBFS']}
            >
              <line x1="10" y1="130" x2="270" y2="130" stroke="currentColor" strokeOpacity="0.1" />
              <line x1="10" y1="10" x2="10" y2="130" stroke="currentColor" strokeOpacity="0.1" />
              {/* 1:1 line without compression */}
              <line x1="10" y1="130" x2="270" y2="40" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 3" />
            </CurveChart>
          </div>
        </ToggleCard>

        {/* Analog saturator. Switching it on without a mode picks tube warmth. */}
        <ToggleCard
          icon={<Flame size={18} />}
          tone="amber"
          title={loc.dynamicsStudio.saturatorTitle}
          badges={<Badge tone={saturatorOn ? 'amber' : 'neutral'} size="xs">{saturatorOn ? state.saturator.mode.toUpperCase() : 'BYPASS'}</Badge>}
          checked={state.saturator.enabled}
          onChange={(on) =>
            setSaturator({ enabled: on, mode: on && state.saturator.mode === 'Off' ? 'TubeWarmth' : state.saturator.mode })
          }
        >
          <div className="mb-4 flex gap-2">
            {saturatorModes.map((m) => (
              <OptionCard
                key={m.id}
                tone="amber"
                pressed={state.saturator.enabled && state.saturator.mode === m.id}
                onClick={() => setSaturator({ mode: m.id, enabled: true })}
                className="flex-1 gap-0.5 rounded-lg px-3 py-2"
              >
                <span className="text-ui font-bold">{m.label}</span>
                <span className="text-xxs text-fg-muted">{m.desc}</span>
              </OptionCard>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_--spacing(70)] items-center gap-5">
            <div className="flex flex-col gap-3">
              <SliderRow
                label={loc.dynamicsStudio.drive}
                tone="amber"
                min={1}
                max={5}
                step={0.05}
                value={state.saturator.drive}
                format={(v) => `${v.toFixed(2)}x`}
                onChange={(v) => setSaturator({ drive: v })}
              />
              {state.saturator.mode === 'TubeWarmth' && (
                <SliderRow
                  label={loc.dynamicsStudio.evenHarmonics}
                  tone="amber"
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.saturator.warmth}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => setSaturator({ warmth: v })}
                />
              )}
              <SliderRow
                label={loc.dynamicsStudio.dryWet}
                tone="amber"
                min={0}
                max={1}
                step={0.01}
                value={state.saturator.mix}
                format={(v) => `${Math.round(v * 100)}% Wet`}
                onChange={(v) => setSaturator({ mix: v })}
              />
            </div>

            <CurveChart
              title={loc.dynamicsStudio.waveshaperCurve}
              tone="amber"
              points={waveshaperCurvePoints}
              axisLabels={['-1.0', '0.0', '+1.0']}
            >
              <line x1="10" y1="70" x2="270" y2="70" stroke="currentColor" strokeOpacity="0.15" />
              <line x1="140" y1="10" x2="140" y2="130" stroke="currentColor" strokeOpacity="0.15" />
              {/* Linear transfer without saturation */}
              <line x1="10" y1="130" x2="270" y2="10" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 3" />
            </CurveChart>
          </div>
        </ToggleCard>

        {/* Headphone master limiter */}
        <ToggleCard
          icon={<Shield size={18} />}
          tone="cyan"
          title={loc.dynamicsStudio.limiterTitle}
          description={loc.dynamicsStudio.limiterDesc}
          badges={
            <Badge tone={state.limiter.enabled ? 'cyan' : 'neutral'} size="xs" mono>
              Ceiling: {state.limiter.ceiling_db.toFixed(1)} dBFS
            </Badge>
          }
          checked={state.limiter.enabled}
          onChange={(on) => applyState({ ...state, limiter: { ...state.limiter, enabled: on } })}
        />
      </ModalBody>

      <ModalFooter className="justify-between">
        <span className="text-xs text-fg-muted">{loc.dynamicsStudio.realTimeTip}</span>
        <Button variant="primary" onClick={onClose}>
          {loc.dynamicsStudio.done}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};
