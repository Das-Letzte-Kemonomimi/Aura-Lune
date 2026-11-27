import React from 'react';
import { TextField } from '../../../components/ui';
import type { AudioSettingsProps } from './audioSettingsProps';
import { PresetOptionCard } from './PresetOptionCard';

export type DspBlockSizeOptionProps = Pick<AudioSettingsProps, 'loc' | 'dspBlockSize' | 'onSetDspBlockSize'>;

const DEFAULT_BLOCK_SIZE = 2048;

export const DspBlockSizeOption: React.FC<DspBlockSizeOptionProps> = ({ dspBlockSize, loc, onSetDspBlockSize }) => (
  <PresetOptionCard
    tone="cyan"
    title={loc.settings.dspBlockSizeTitle}
    description={loc.settings.dspBlockSizeDesc}
    value={dspBlockSize}
    readout={`${dspBlockSize} ${loc.settings.dspBlockSizeFrames}`}
    defaultValue={DEFAULT_BLOCK_SIZE}
    defaultBadge={loc.settings.dspBlockSizeDefault}
    resetLabel={loc.settings.dspBlockSizeDefaultLabel}
    resetTitle={loc.settings.dspBlockSizeReset}
    presets={[
      { label: loc.settings.dspBlockPreset512, value: 512 },
      { label: loc.settings.dspBlockPreset1024, value: 1024 },
      { label: loc.settings.dspBlockPreset2048, value: 2048 },
      { label: loc.settings.dspBlockPreset4096, value: 4096 },
      { label: loc.settings.dspBlockPreset8192, value: 8192 },
    ]}
    onChange={onSetDspBlockSize}
    presetsEnd={
      <>
        <span className="text-xs text-fg-muted">{loc.settings.dspBlockCustom}</span>
        <TextField
          type="number"
          size="sm"
          mono
          aria-label={loc.settings.dspBlockSizeTitle}
          min={256}
          max={16384}
          step={256}
          value={dspBlockSize}
          onChange={(e) => onSetDspBlockSize(Number(e.target.value))}
          className="w-20 text-center"
        />
      </>
    }
  />
);
