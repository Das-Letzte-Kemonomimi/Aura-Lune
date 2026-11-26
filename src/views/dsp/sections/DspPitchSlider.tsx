import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import { Target } from '../../../components/ui/icons';
import { SpeedSliderCard } from './SpeedSliderCard';

export type DspPitchSliderProps = Pick<DspStudioViewProps, 'loc' | 'handlePitchChange' | 'dspCombination'> & {
  status: PlaybackStatus;
};

/** Semitones with an explicit sign: `+2.00`, `-0.50`, `0.00`. */
const signed = (v: number) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

/** Pitch shift: the key without changing the speed. Shows the resulting key. */
export const DspPitchSlider: React.FC<DspPitchSliderProps> = ({ dspCombination, handlePitchChange, loc, status }) => {
  const pitch = status.pitch_semitones ?? 0;
  const caps = status.capabilities;
  const { totalKey, totalPitchSemitones } = dspCombination;
  return (
    <SpeedSliderCard
      label={loc.dsp.pitch}
      tone="pink"
      value={pitch}
      onChange={handlePitchChange}
      sliderMin={caps?.min_pitch_semitones ?? -12}
      sliderMax={caps?.max_pitch_semitones ?? 12}
      min={caps?.min_pitch_semitones ?? -24}
      max={caps?.max_pitch_semitones ?? 24}
      formatEntry={signed}
      placeholder="0.00"
      entryTitle={loc.dsp.enterValuePitch}
      unit={`${loc.dsp.semitones} (${Math.round(pitch * 100)} ${loc.dsp.cents}) | ${(2 ** (pitch / 12)).toFixed(3)}x`}
      presets={[-12, -7, -2, 0, 2, 7, 12].map((st) => ({
        value: st,
        label: st === 0 ? `0 ${loc.dsp.semitones}` : st > 0 ? `+${st}` : String(st),
      }))}
      info={
        totalKey ? (
          <span>
            <Target size={12} className="icon-inline mr-1" />
            {loc.dsp.keyLabel}: <strong className="text-fg">{totalKey.camelot}</strong> ({totalKey.keyName})
            {totalKey.centsOffset !== 0 ? ` ${totalKey.centsOffset > 0 ? '+' : ''}${totalKey.centsOffset}¢` : ''}
            {dspCombination.hasRate && (
              <span className="ml-1 text-xxs text-accent-amber">(Σ {signed(totalPitchSemitones)} st)</span>
            )}
          </span>
        ) : (
          <span className="text-fg-muted">
            <Target size={12} className="icon-inline mr-1" />
            {loc.dsp.keyLabel}: {signed(totalPitchSemitones)} st
            {dspCombination.hasRate &&
              ` (${pitch.toFixed(2)} st + rate ${(dspCombination.rateSemitones > 0 ? '+' : '') + dspCombination.rateSemitones.toFixed(2)} st)`}
            {loc.dsp.noBaseKey}
          </span>
        )
      }
    />
  );
};
