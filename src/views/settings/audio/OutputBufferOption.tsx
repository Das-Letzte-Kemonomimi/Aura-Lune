import React from 'react';
import { Layers } from '../../../components/ui/icons';
import { TextField } from '../../../components/ui';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';
import { cssVars } from '../../../utils/cssVars';
import { PresetOptionCard } from './PresetOptionCard';

export type OutputBufferOptionProps = Pick<AudioDevicesSettingsViewProps, 'loc' | 'audioBufferMs' | 'onSetAudioBuffer'>;

const DEFAULT_BUFFER_MS = 600;
const SLIDER_MIN = 50;
const SLIDER_MAX = 2000;

export const OutputBufferOption: React.FC<OutputBufferOptionProps> = ({ audioBufferMs, loc, onSetAudioBuffer }) => {
  const fill = ((Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, audioBufferMs)) - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
  return (
    <PresetOptionCard
      icon={<Layers size={20} />}
      tone="pink"
      title={loc.settings.audioBufferTitle}
      description={loc.settings.audioBufferDesc}
      value={audioBufferMs}
      readout={`${audioBufferMs} ms`}
      defaultValue={DEFAULT_BUFFER_MS}
      defaultBadge={loc.settings.audioBufferDefault}
      resetLabel={loc.settings.audioBufferDefaultLabel}
      resetTitle={loc.settings.audioBufferReset}
      presets={[
        { label: '80 ms (Ultra-low)', value: 80 },
        { label: loc.settings.audioBufferPreset250, value: 250 },
        { label: loc.settings.audioBufferPreset600, value: 600 },
        { label: loc.settings.audioBufferPreset1000, value: 1000 },
        { label: loc.settings.audioBufferPreset2000, value: 2000 },
      ]}
      onChange={onSetAudioBuffer}
    >
      <div className="flex items-center gap-3.5">
        <input
          type="range"
          aria-label={loc.settings.audioBufferTitle}
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={25}
          value={audioBufferMs}
          onChange={(e) => onSetAudioBuffer(Number(e.target.value))}
          className="range-fill flex-1"
          style={cssVars({ '--fill': `${fill}%` })}
        />
        <div className="flex items-center gap-1.5">
          <TextField
            type="number"
            size="sm"
            mono
            aria-label={loc.settings.audioBufferTitle}
            min={SLIDER_MIN}
            max={4000}
            value={audioBufferMs}
            onChange={(e) => onSetAudioBuffer(Number(e.target.value))}
            className="w-18 text-center"
          />
          <span className="text-ui text-fg-muted">ms</span>
        </div>
      </div>
    </PresetOptionCard>
  );
};
