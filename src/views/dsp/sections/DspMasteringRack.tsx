import React from 'react';
import { AlertTriangle, Flame, Headphones, ShieldCheck, SlidersHorizontal } from '../../../components/ui/icons';
import type { DspStudioViewProps } from '../DspStudioView';
import { Badge, Callout, Chip, RangeSlider, SliderRow, ToggleCard } from '../../../components/ui';

export type DspMasteringRackProps = Pick<
  DspStudioViewProps,
  | 'loc'
  | 'handleBassBoostChange'
  | 'bassBoost'
  | 'lastBassBoostRef'
  | 'handleToggleStereoWidener'
  | 'stereoWidenerActive'
  | 'stereoWidenerAmount'
  | 'handleStereoWidenerAmountChange'
  | 'handleToggleLimiter'
  | 'limiterEnabled'
  | 'handleSetCrossfeed'
  | 'crossfeedEnabled'
  | 'crossfeedPreset'
  | 'crossfeedFcut'
  | 'crossfeedFeed'
>;

const BASS_PRESETS_DB = [0, 3, 6, 9, 12] as const;

/** Bass boost, stereo widener, true-peak limiter and Bauer crossfeed (bs2b), one card each. */
export const DspMasteringRack: React.FC<DspMasteringRackProps> = ({
  bassBoost,
  crossfeedEnabled,
  crossfeedFcut,
  crossfeedFeed,
  crossfeedPreset,
  handleBassBoostChange,
  handleSetCrossfeed,
  handleStereoWidenerAmountChange,
  handleToggleLimiter,
  handleToggleStereoWidener,
  lastBassBoostRef,
  limiterEnabled,
  loc,
  stereoWidenerActive,
  stereoWidenerAmount,
}) => {
  const crossfeedPresets = [
    { id: 'Default', label: 'Default (700Hz/4.5dB)' },
    { id: 'ChuMoy', label: 'Chu Moy (700Hz/6dB)' },
    { id: 'JanMeier', label: 'Jan Meier (650Hz/9dB)' },
    { id: 'Custom', label: loc.settings.crossfeedPresetCustom },
  ] as const;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(72),1fr))] gap-4">
      {/* Bass boost (sub-bass exciter). Switching it back on restores the last boost. */}
      <ToggleCard
        icon={<Flame size={18} />}
        tone="pink"
        title={loc.dsp.bassBoostTitle}
        description={loc.dsp.bassBoostDesc}
        badges={bassBoost > 0 && <Badge tone="pink" mono>+{bassBoost.toFixed(1)} dB</Badge>}
        checked={bassBoost > 0}
        onChange={(on) => handleBassBoostChange(on ? lastBassBoostRef?.current || 6 : 0)}
      >
        <RangeSlider
          aria-label={loc.dsp.bassBoostTitle}
          min={0}
          max={12}
          step={0.5}
          value={bassBoost}
          onChange={handleBassBoostChange}
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {BASS_PRESETS_DB.map((db) => (
            <Chip key={db} size="xs" pressed={bassBoost === db} onClick={() => handleBassBoostChange(db)}>
              {db === 0 ? '0 dB (Off)' : `+${db} dB`}
            </Chip>
          ))}
        </div>
      </ToggleCard>

      {/* Stereo widener */}
      <ToggleCard
        icon={<SlidersHorizontal size={18} />}
        tone="cyan"
        title={loc.dsp.stereoWidenerTitle}
        description={loc.dsp.stereoWidenerDesc}
        checked={stereoWidenerActive}
        onChange={handleToggleStereoWidener}
      >
        <SliderRow
          label={loc.dsp.stereoStageWidth}
          tone="cyan"
          min={0}
          max={1}
          step={0.02}
          value={stereoWidenerAmount}
          format={(v) => `${Math.round(v * 100)}%`}
          disabled={!stereoWidenerActive}
          onChange={handleStereoWidenerAmountChange}
        />
      </ToggleCard>

      {/* True-peak limiter */}
      <ToggleCard
        icon={<ShieldCheck size={18} />}
        tone="green"
        title={loc.dsp.limiterTitle}
        description={loc.dsp.limiterDesc}
        checked={limiterEnabled}
        onChange={handleToggleLimiter}
      >
        {!limiterEnabled && (
          <Callout tone="amber" icon={<AlertTriangle size={14} />} className="py-2 text-xs text-fg">
            {loc.dsp.limiterOffWarning}
          </Callout>
        )}
      </ToggleCard>

      {/* Bauer headphone crossfeed (bs2b). Picking a preset also switches it on. */}
      <ToggleCard
        icon={<Headphones size={18} />}
        tone="purple"
        title={loc.settings.crossfeedTitle}
        description={loc.settings.crossfeedDesc}
        checked={crossfeedEnabled}
        onChange={(on) => handleSetCrossfeed(on, crossfeedPreset)}
      >
        <div className="flex flex-wrap gap-1.5">
          {crossfeedPresets.map((p) => (
            <Chip
              key={p.id}
              size="xs"
              tone="purple"
              pressed={crossfeedEnabled && crossfeedPreset === p.id}
              onClick={() => handleSetCrossfeed(true, p.id)}
            >
              {p.label}
            </Chip>
          ))}
        </div>
        {crossfeedPreset === 'Custom' && (
          <div className="mt-3 flex flex-col gap-3">
            <SliderRow
              label={loc.settings.crossfeedFcut}
              tone="purple"
              min={300}
              max={2000}
              step={25}
              value={crossfeedFcut}
              format={(v) => `${v} Hz`}
              onChange={(v) => handleSetCrossfeed(true, 'Custom', v, crossfeedFeed)}
            />
            <SliderRow
              label={loc.settings.crossfeedFeed}
              tone="purple"
              min={10}
              max={150}
              step={5}
              value={crossfeedFeed}
              format={(v) => `${(v / 10).toFixed(1)} dB`}
              onChange={(v) => handleSetCrossfeed(true, 'Custom', crossfeedFcut, v)}
            />
          </div>
        )}
      </ToggleCard>
    </div>
  );
};
