import React from 'react';
import { type VolumeOsdPosition } from '../../../components/player/VolumeOsd';
import { SegmentedControl, Select, SettingRow, SettingsGroup } from '../../../components/ui';
import type { AudioSettingsProps } from './audioSettingsProps';

export type VolumeAndOsdCardProps = Pick<
  AudioSettingsProps,
  | 'loc'
  | 'instantVolume'
  | 'onToggleInstantVolume'
  | 'volumeUnit'
  | 'onSetVolumeUnit'
  | 'volumeCurve'
  | 'onSetVolumeCurve'
  | 'volumeOsdPosition'
  | 'onSetVolumeOsdPosition'
>;

/** Volume slider response, display unit, curve and on-screen display position. */
export const VolumeAndOsdCard: React.FC<VolumeAndOsdCardProps> = ({
  instantVolume,
  loc,
  onSetVolumeOsdPosition,
  onSetVolumeCurve,
  onSetVolumeUnit,
  onToggleInstantVolume,
  volumeCurve,
  volumeOsdPosition,
  volumeUnit,
}) => (
  <SettingsGroup label={loc.settings.volumeSectionTitle}>
    {/* Volume mode: instant vs smooth */}
    <SettingRow
      compact
      title={loc.settings.volumeSliderResponse}
      description={instantVolume ? loc.settings.volumeSliderInstantDesc : loc.settings.volumeSliderSmoothDesc}
      control={
        <SegmentedControl
          size="sm"
          tone="cyan"
          label={loc.settings.volumeSliderResponse}
          items={[
            { value: 'smooth', label: loc.settings.volumeSliderSmooth },
            { value: 'instant', label: loc.settings.volumeSliderInstant },
          ]}
          value={instantVolume ? 'instant' : 'smooth'}
          onChange={(mode) => {
            if ((mode === 'instant') !== instantVolume) onToggleInstantVolume();
          }}
        />
      }
    />

    {/* Volume display unit: percent vs decibels */}
    <SettingRow
      compact
      title={loc.settings.volumeUnitTitle}
      description={volumeUnit === 'db' ? loc.settings.volumeUnitDb : loc.settings.volumeUnitPercent}
      control={
        <SegmentedControl
          size="sm"
          tone="cyan"
          label={loc.settings.volumeUnitTitle}
          items={[
            { value: 'percent', label: '%' },
            { value: 'db', label: 'dB' },
          ]}
          value={volumeUnit}
          onChange={onSetVolumeUnit}
        />
      }
    />

    {/* Volume slider curve: how the slider position maps to loudness */}
    <SettingRow
      compact
      title={loc.settings.volumeCurveTitle}
      description={volumeCurve === 'db-linear' ? loc.settings.volumeCurveDbLinearDesc : loc.settings.volumeCurveCubicDesc}
      control={
        <SegmentedControl
          size="sm"
          tone="cyan"
          label={loc.settings.volumeCurveTitle}
          items={[
            { value: 'cubic', label: loc.settings.volumeCurveCubic },
            { value: 'db-linear', label: loc.settings.volumeCurveDbLinear },
          ]}
          value={volumeCurve}
          onChange={onSetVolumeCurve}
        />
      }
    />

    {/* Volume OSD position */}
    <SettingRow
      compact
      title={loc.settings.volumeOsdPosTitle}
      description={loc.settings.volumeOsdPosDesc}
      control={
        <Select
          aria-label={loc.settings.volumeOsdPosTitle}
          value={volumeOsdPosition}
          onChange={(e) => onSetVolumeOsdPosition(e.target.value as VolumeOsdPosition)}
          className="w-auto"
        >
          <option value="bottom-right">{loc.settings.volumeOsdBottomRight}</option>
          <option value="bottom-center">{loc.settings.volumeOsdBottomCenter}</option>
          <option value="center">{loc.settings.volumeOsdCenter}</option>
          <option value="top-right">{loc.settings.volumeOsdTopRight}</option>
          <option value="top-left">{loc.settings.volumeOsdTopLeft}</option>
          <option value="bottom-left">{loc.settings.volumeOsdBottomLeft}</option>
          <option value="off">{loc.settings.volumeOsdOff}</option>
        </Select>
      }
    />
  </SettingsGroup>
);
