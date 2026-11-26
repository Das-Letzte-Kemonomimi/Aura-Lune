import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import { Target, Zap } from '../../../components/ui/icons';
import { SpeedSliderCard } from './SpeedSliderCard';
import { formatRatioStep, ratioPreset } from './speedSliderModel';

export type DspRateSliderProps = Pick<DspStudioViewProps, 'loc' | 'handleRateChange' | 'dspCombination'> & {
  status: PlaybackStatus;
};

const RATE_PRESETS = [0.8, 0.9, 1.0, 1.1, 1.25].map(ratioPreset);

/** Rate: speed and pitch together, like a turntable. Shows the resulting key and tempo. */
export const DspRateSlider: React.FC<DspRateSliderProps> = ({ dspCombination, handleRateChange, loc, status }) => {
  const rate = status.rate_ratio ?? 1;
  const { totalKey, totalBpm } = dspCombination;
  return (
    <SpeedSliderCard
      label={loc.dsp.speed}
      tone="amber"
      value={rate}
      onChange={handleRateChange}
      sliderMin={0.5}
      sliderMax={2.0}
      min={0.1}
      max={3.0}
      formatStep={formatRatioStep}
      formatEntry={(v) => v.toFixed(2)}
      placeholder="1.00"
      entryTitle={loc.dsp.enterValueSpeed}
      unit={`x (${Math.round(rate * 100)}%)`}
      presets={RATE_PRESETS}
      info={
        <>
          {totalKey ? (
            <span>
              <Target size={12} className="icon-inline mr-1" />
              {loc.dsp.keyLabel}: <strong className="text-fg">{totalKey.camelot}</strong> ({totalKey.keyName})
              {totalKey.centsOffset !== 0 ? ` ${totalKey.centsOffset > 0 ? '+' : ''}${totalKey.centsOffset}¢` : ''}
            </span>
          ) : (
            <span className="text-fg-muted">
              <Target size={12} className="icon-inline mr-1" />
              {loc.dsp.keyLabel}: {(dspCombination.totalPitchSemitones > 0 ? '+' : '') + dspCombination.totalPitchSemitones.toFixed(2)} st
            </span>
          )}
          <span aria-hidden="true">•</span>
          {totalBpm ? (
            <span>
              <Zap size={12} className="icon-inline mr-1" />
              Tempo: <strong className="text-fg">{totalBpm.toFixed(1)} BPM</strong>
            </span>
          ) : (
            <span className="text-fg-muted">
              <Zap size={12} className="icon-inline mr-1" />
              Tempo: {dspCombination.totalSpeedRatio.toFixed(2)}x
            </span>
          )}
        </>
      }
    />
  );
};
