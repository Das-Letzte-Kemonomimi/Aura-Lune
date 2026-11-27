import React from 'react';
import { SegmentedControl, SliderRow } from '../../../components/ui';
import { ToggleRow } from '../ToggleRow';
import type { AudioSettingsProps } from './audioSettingsProps';

export type CrossfeedOptionProps = Pick<
  AudioSettingsProps,
  'crossfeedEnabled' | 'loc' | 'onSetCrossfeed' | 'crossfeedPreset' | 'crossfeedFcut' | 'crossfeedFeed'
>;

export const CrossfeedOption: React.FC<CrossfeedOptionProps> = ({
  crossfeedEnabled,
  crossfeedFcut,
  crossfeedFeed,
  crossfeedPreset,
  loc,
  onSetCrossfeed,
}) => {
  const presets = [
    { id: 'Default', label: loc.settings.crossfeedPresetDefault },
    { id: 'ChuMoy', label: loc.settings.crossfeedPresetChuMoy },
    { id: 'JanMeier', label: loc.settings.crossfeedPresetJanMeier },
    { id: 'Custom', label: loc.settings.crossfeedPresetCustom },
  ] as const;
  const slidersEnabled = crossfeedEnabled && crossfeedPreset === 'Custom';

  return (
    <ToggleRow
      title={loc.settings.crossfeedTitle}
      description={loc.settings.crossfeedDesc}
      checked={crossfeedEnabled}
      onChange={(on) => onSetCrossfeed(on, crossfeedPreset)}
    >
      {crossfeedEnabled && (
        <div className="flex flex-col gap-3">
          {/* Preset choice: Default / ChuMoy / JanMeier / Custom */}
          <SegmentedControl
            size="sm"
            tone="cyan"
            label={loc.settings.crossfeedTitle}
            items={presets.map((p) => ({ value: p.id, label: p.label }))}
            value={crossfeedPreset}
            onChange={(id) => onSetCrossfeed(crossfeedEnabled, id)}
            className="self-start"
          />

          {/* Frequency and feed sliders (editable with the Custom preset) */}
          <SliderRow
            label={loc.settings.crossfeedFcut}
            tone="cyan"
            min={300}
            max={2000}
            step={25}
            value={crossfeedFcut}
            format={(v) => `${v} Hz`}
            disabled={!slidersEnabled}
            onChange={(v) => onSetCrossfeed(crossfeedEnabled, 'Custom', v, crossfeedFeed)}
          />
          <SliderRow
            label={loc.settings.crossfeedFeed}
            tone="cyan"
            min={10}
            max={150}
            step={5}
            value={crossfeedFeed}
            format={(v) => `${(v / 10).toFixed(1)} dB`}
            disabled={!slidersEnabled}
            onChange={(v) => onSetCrossfeed(crossfeedEnabled, 'Custom', crossfeedFcut, v)}
          />
        </div>
      )}
    </ToggleRow>
  );
};
