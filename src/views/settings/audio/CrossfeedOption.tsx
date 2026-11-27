import React from 'react';
import { Headphones } from '../../../components/ui/icons';
import { Chip, SliderRow, ToggleCard } from '../../../components/ui';
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
    <ToggleCard
      icon={<Headphones size={20} />}
      tone="cyan"
      title={loc.settings.crossfeedTitle}
      description={loc.settings.crossfeedDesc}
      checked={crossfeedEnabled}
      onChange={(on) => onSetCrossfeed(on, crossfeedPreset)}
    >
      {/* Preset choice: Default / ChuMoy / JanMeier / Custom */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(32.5),1fr))] gap-2">
        {presets.map((p) => (
          <Chip
            key={p.id}
            pressed={crossfeedPreset === p.id}
            tone="cyan"
            disabled={!crossfeedEnabled}
            onClick={() => onSetCrossfeed(crossfeedEnabled, p.id)}
            className="py-2 whitespace-normal"
          >
            {p.label}
          </Chip>
        ))}
      </div>

      {/* Frequency and feed sliders (editable with the Custom preset) */}
      <div className="mt-4 flex flex-col gap-3">
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
    </ToggleCard>
  );
};
