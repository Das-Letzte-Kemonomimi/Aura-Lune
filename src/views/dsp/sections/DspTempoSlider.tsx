import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import { Zap } from '../../../components/ui/icons';
import { SpeedSliderCard } from './SpeedSliderCard';
import { formatRatioStep, ratioPreset } from './speedSliderModel';

export type DspTempoSliderProps = Pick<
  DspStudioViewProps,
  'loc' | 'handleTempoChange' | 'dspCombination' | 'activeTrackKeyBpm'
> & {
  status: PlaybackStatus;
};

const TEMPO_PRESETS = [0.75, 1.0, 1.25, 1.5, 1.75].map(ratioPreset);

/** Tempo (time stretch): speed without changing the key. Shows the resulting BPM. */
export const DspTempoSlider: React.FC<DspTempoSliderProps> = ({
  activeTrackKeyBpm,
  dspCombination,
  handleTempoChange,
  loc,
  status,
}) => {
  const tempo = status.tempo_ratio ?? 1;
  const caps = status.capabilities;
  return (
    <SpeedSliderCard
      label={loc.dsp.tempo}
      tone="cyan"
      value={tempo}
      onChange={handleTempoChange}
      sliderMin={caps?.min_tempo_ratio ?? 0.5}
      sliderMax={caps?.max_tempo_ratio ?? 2.0}
      min={caps?.min_tempo_ratio ?? 0.1}
      max={caps?.max_tempo_ratio ?? 3.0}
      formatStep={formatRatioStep}
      formatEntry={(v) => v.toFixed(2)}
      placeholder="1.00"
      entryTitle={loc.dsp.enterValueTempo}
      unit={`x (${Math.round(tempo * 100)}%)`}
      presets={TEMPO_PRESETS}
      info={
        dspCombination.totalBpm ? (
          <span>
            <Zap size={12} className="icon-inline mr-1" />
            Tempo: <strong className="text-fg">{dspCombination.totalBpm.toFixed(1)} BPM</strong>
            {activeTrackKeyBpm?.bpm ? ` (${loc.dsp.fromBpm} ${activeTrackKeyBpm.bpm.toFixed(1)})` : ''}
            {dspCombination.hasRate && (
              <span className="ml-1 text-xxs text-accent-amber">(Σ {dspCombination.totalSpeedRatio.toFixed(2)}x)</span>
            )}
          </span>
        ) : (
          <span className="text-fg-muted">
            <Zap size={12} className="icon-inline mr-1" />
            Tempo: {dspCombination.totalSpeedRatio.toFixed(2)}x
            {dspCombination.hasRate && ` (${tempo.toFixed(2)}x × rate ${(status.rate_ratio ?? 1).toFixed(2)}x)`}
            {loc.dsp.noBaseBpm}
          </span>
        )
      }
    />
  );
};
