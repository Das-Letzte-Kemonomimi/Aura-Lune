import React from 'react';
import { Volume2 } from '../../../components/ui/icons';
import { type VolumeOsdPosition } from '../../../components/player/VolumeOsd';
import { Card, SectionHeader, SegmentedControl, Select, SettingRow } from '../../../components/ui';
import { ToggleSwitch } from '../../../components/common/ToggleSwitch';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';

export type VolumeAndOsdCardProps = Pick<
  AudioDevicesSettingsViewProps,
  | 'loc'
  | 'instantVolume'
  | 'onToggleInstantVolume'
  | 'volumeUnit'
  | 'onSetVolumeUnit'
  | 'volumeOsdPosition'
  | 'onSetVolumeOsdPosition'
  | 'onToggleRecapOptIn'
  | 'recapOptIn'
>;

export const VolumeAndOsdCard: React.FC<VolumeAndOsdCardProps> = ({
  instantVolume,
  loc,
  onSetVolumeOsdPosition,
  onSetVolumeUnit,
  onToggleInstantVolume,
  onToggleRecapOptIn,
  recapOptIn,
  volumeOsdPosition,
  volumeUnit,
}) => (
  <Card>
    <SectionHeader icon={<Volume2 size={20} />} tone="cyan" title={loc.settings.volumeSectionTitle} />

    <div className="mt-2 divide-y divide-line">
      {/* Volume mode: instant vs smooth */}
      <SettingRow
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

      {/* Volume OSD position */}
      <SettingRow
        title={loc.settings.volumeOsdPosTitle}
        description={loc.settings.volumeOsdPosDesc}
        control={
          <Select
            aria-label={loc.settings.volumeOsdPosTitle}
            value={volumeOsdPosition}
            onChange={(e) => onSetVolumeOsdPosition(e.target.value as VolumeOsdPosition)}
            className="w-auto"
          >
            <option value="bottom-center">{loc.settings.volumeOsdBottomCenter}</option>
            <option value="center">{loc.settings.volumeOsdCenter}</option>
            <option value="top-right">{loc.settings.volumeOsdTopRight}</option>
            <option value="top-left">{loc.settings.volumeOsdTopLeft}</option>
            <option value="bottom-right">{loc.settings.volumeOsdBottomRight}</option>
            <option value="bottom-left">{loc.settings.volumeOsdBottomLeft}</option>
            <option value="off">{loc.settings.volumeOsdOff}</option>
          </Select>
        }
      />

      {/* Auralune Recap consent (opt-in) */}
      <SettingRow
        title={loc.settings.recapTitle}
        description={loc.settings.recapDesc}
        control={<ToggleSwitch checked={recapOptIn} onChange={onToggleRecapOptIn} label={loc.settings.recapTitle} />}
        className="pb-0"
      />
    </div>
  </Card>
);
