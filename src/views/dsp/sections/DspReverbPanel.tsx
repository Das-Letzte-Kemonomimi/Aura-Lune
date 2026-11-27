import React from 'react';
import { Sparkles } from '../../../components/ui/icons';
import type { DspStudioViewProps } from '../DspStudioView';
import { Button, SliderRow, ToggleCard } from '../../../components/ui';

export type DspReverbPanelProps = Pick<
  DspStudioViewProps,
  | 'reverbEnabled'
  | 'loc'
  | 'handleUpdateReverb'
  | 'reverbRoomSize'
  | 'reverbDamping'
  | 'reverbWidth'
  | 'reverbLevel'
  | 'handleTempoChange'
  | 'handlePitchChange'
  | 'showMessage'
>;

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** Room size, damping, width and wet level, as `handleUpdateReverb` takes them. */
const REVERB_PRESETS = [
  { label: 'Small Room', params: [0.4, 0.5, 0.7, 0.25] },
  { label: 'Ambient Hall', params: [0.7, 0.3, 0.9, 0.35] },
  { label: 'Cathedral', params: [0.85, 0.15, 1.0, 0.45] },
] as const;

export const DspReverbPanel: React.FC<DspReverbPanelProps> = ({
  handlePitchChange,
  handleTempoChange,
  handleUpdateReverb,
  loc,
  reverbDamping,
  reverbEnabled,
  reverbLevel,
  reverbRoomSize,
  reverbWidth,
  showMessage,
}) => {
  const sliders = [
    { label: 'Room Size', value: reverbRoomSize, set: (v: number) => handleUpdateReverb(true, v) },
    { label: loc.dsp.dampingLabel, value: reverbDamping, set: (v: number) => handleUpdateReverb(true, undefined, v) },
    {
      label: loc.dsp.stereoWidthLabel,
      value: reverbWidth,
      set: (v: number) => handleUpdateReverb(true, undefined, undefined, v),
    },
    {
      label: 'Wet Level',
      value: reverbLevel,
      set: (v: number) => handleUpdateReverb(true, undefined, undefined, undefined, v),
    },
  ];

  return (
    <ToggleCard
      icon={<Sparkles size={18} />}
      tone="purple"
      title={loc.dsp.spatialReverbTitle}
      description={loc.dsp.spatialReverbDesc}
      checked={reverbEnabled}
      onChange={(on) => handleUpdateReverb(on)}
    >
      <div className="grid grid-cols-2 gap-4">
        {sliders.map((s) => (
          <SliderRow
            key={s.label}
            label={s.label}
            tone="purple"
            min={0}
            max={1}
            step={0.01}
            value={s.value}
            format={percent}
            disabled={!reverbEnabled}
            onChange={s.set}
          />
        ))}
      </div>

      {/* Quick presets; each one also switches the reverb on */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-fg-muted">Presets:</span>
        {REVERB_PRESETS.map((p) => (
          <Button key={p.label} size="sm" onClick={() => handleUpdateReverb(true, ...p.params)}>
            {p.label}
          </Button>
        ))}
        {/* The user's favourite profile: Slowed + Reverb */}
        <Button
          variant="tinted"
          tone="pink"
          size="sm"
          onClick={() => {
            handleTempoChange(0.82);
            handlePitchChange(-2.0);
            handleUpdateReverb(true, 0.75, 0.35, 1.0, 0.4);
            showMessage('Activated profile: Slowed + Reverb 🌌');
          }}
        >
          🌌 Slowed + Reverb
        </Button>
      </div>
    </ToggleCard>
  );
};
