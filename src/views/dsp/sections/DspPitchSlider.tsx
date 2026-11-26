import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';

export type DspPitchSliderProps = Pick<DspStudioViewProps, 'loc' | 'handlePitchChange' | 'dspCombination'> & {
  status: PlaybackStatus;
  editingPitch: string | null;
  setEditingPitch: Dispatch<SetStateAction<string | null>>;
};

export const DspPitchSlider: React.FC<DspPitchSliderProps> = ({
  dspCombination,
  editingPitch,
  handlePitchChange,
  loc,
  setEditingPitch,
  status,
}) => (
    <div className="mb-7">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-sm font-semibold">{loc.dsp.pitch}:</label>
          <button
            onClick={() => handlePitchChange(Math.max(-24, Math.round(((status.pitch_semitones ?? 0) - 0.1) * 100) / 100))}
            className="rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-xxs text-fg-muted"
            title="-0.1 semitone"
          >
            -0.1
          </button>
          <button
            onClick={() => handlePitchChange(Math.max(-24, Math.round(((status.pitch_semitones ?? 0) - 0.01) * 100) / 100))}
            className="rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-xxs text-fg-muted"
            title="-0.01 semitone"
          >
            -0.01
          </button>
          <button
            onClick={() => handlePitchChange(Math.min(24, Math.round(((status.pitch_semitones ?? 0) + 0.01) * 100) / 100))}
            className="rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-xxs text-fg-muted"
            title="+0.01 semitone"
          >
            +0.01
          </button>
          <button
            onClick={() => handlePitchChange(Math.min(24, Math.round(((status.pitch_semitones ?? 0) + 0.1) * 100) / 100))}
            className="rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-xxs text-fg-muted"
            title="+0.1 semitone"
          >
            +0.1
          </button>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={
                editingPitch !== null
                  ? editingPitch
                  : (status.pitch_semitones ?? 0) > 0
                    ? `+${(status.pitch_semitones ?? 0).toFixed(2)}`
                    : (status.pitch_semitones ?? 0).toFixed(2)
              }
              onFocus={(e) => {
                setEditingPitch(
                  (status.pitch_semitones ?? 0) > 0
                    ? `+${(status.pitch_semitones ?? 0).toFixed(2)}`
                    : (status.pitch_semitones ?? 0).toFixed(2)
                );
                e.target.select();
              }}
              onChange={(e) => setEditingPitch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const step = e.shiftKey ? 0.01 : 0.1;
                  const clean = (editingPitch ?? `${status.pitch_semitones ?? 0}`).replace(',', '.').trim();
                  const current = parseFloat(clean);
                  if (!isNaN(current)) {
                    const next = Math.min(24, Math.round((current + step) * 100) / 100);
                    setEditingPitch(next > 0 ? `+${next.toFixed(2)}` : next.toFixed(2));
                    handlePitchChange(next);
                  }
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const step = e.shiftKey ? 0.01 : 0.1;
                  const clean = (editingPitch ?? `${status.pitch_semitones ?? 0}`).replace(',', '.').trim();
                  const current = parseFloat(clean);
                  if (!isNaN(current)) {
                    const next = Math.max(-24, Math.round((current - step) * 100) / 100);
                    setEditingPitch(next > 0 ? `+${next.toFixed(2)}` : next.toFixed(2));
                    handlePitchChange(next);
                  }
                } else if (e.key === 'Enter') {
                  const clean = (editingPitch ?? '').replace(',', '.').trim();
                  const val = parseFloat(clean);
                  if (!isNaN(val)) {
                    const min = status.capabilities?.min_pitch_semitones ?? -24;
                    const max = status.capabilities?.max_pitch_semitones ?? 24;
                    const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                    handlePitchChange(clamped);
                  }
                  setEditingPitch(null);
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  setEditingPitch(null);
                  e.currentTarget.blur();
                }
              }}
              onBlur={() => {
                if (editingPitch !== null) {
                  const clean = editingPitch.replace(',', '.').trim();
                  const val = parseFloat(clean);
                  if (!isNaN(val)) {
                    const min = status.capabilities?.min_pitch_semitones ?? -24;
                    const max = status.capabilities?.max_pitch_semitones ?? 24;
                    const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                    handlePitchChange(clamped);
                  }
                  setEditingPitch(null);
                }
              }}
              placeholder="0.00"
              title={loc.dsp.enterValuePitch}
              className="w-15 cursor-text rounded-md border border-accent-pink/40 bg-white/8 px-1.5 py-0.5 text-center font-mono text-ui font-bold text-accent-pink outline-none"
            />
            <span className="font-mono text-sm font-semibold text-accent-pink">
              {loc.dsp.semitones} ({Math.round((status.pitch_semitones ?? 0) * 100)} {loc.dsp.cents}) | {(2 ** ((status.pitch_semitones ?? 0) / 12)).toFixed(3)}x
            </span>
          </div>
          {/* Wskaźnik wynikowej tonacji (Key) pod wskaźnikiem */}
          <div className="flex flex-wrap items-center justify-end gap-1 text-xs font-semibold text-accent-pink">
            {dspCombination.totalKey ? (
              <span>
                🎯 {loc.dsp.keyLabel}: <strong className="text-fg">{dspCombination.totalKey.camelot}</strong> ({dspCombination.totalKey.keyName})
                {dspCombination.totalKey.centsOffset !== 0 ? ` ${dspCombination.totalKey.centsOffset > 0 ? '+' : ''}${dspCombination.totalKey.centsOffset}¢` : ''}
                {dspCombination.hasRate && (
                  <span className="ml-1 text-xxs text-accent-amber">
                    (Σ {dspCombination.totalPitchSemitones > 0 ? `+${dspCombination.totalPitchSemitones.toFixed(2)}` : dspCombination.totalPitchSemitones.toFixed(2)} st)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-fg-muted">
                🎯 {loc.dsp.keyLabel}: {dspCombination.totalPitchSemitones > 0 ? `+${dspCombination.totalPitchSemitones.toFixed(2)}` : dspCombination.totalPitchSemitones.toFixed(2)} st
                {dspCombination.hasRate && ` (${(status.pitch_semitones ?? 0).toFixed(2)} st + rate ${(dspCombination.rateSemitones > 0 ? '+' : '') + dspCombination.rateSemitones.toFixed(2)} st)`}
                {loc.dsp.noBaseKey}
              </span>
            )}
          </div>
        </div>
      </div>
      <input
        type="range"
        min={status.capabilities?.min_pitch_semitones ?? -12}
        max={status.capabilities?.max_pitch_semitones ?? 12}
        step={0.01}
        value={status.pitch_semitones ?? 0}
        onChange={(e) => handlePitchChange(Number(e.target.value))}
        className="mb-3 w-full"
      />
      <div className="flex gap-1.5">
        {[-12, -7, -2, 0, 2, 7, 12].map((st) => (
          <button
            key={st}
            onClick={() => handlePitchChange(st)}
            className={cn(
              'flex-1 rounded-lg border px-0 py-2 text-xs font-semibold',
              st === 0 ? 'bg-accent-cyan/20' : 'bg-white/5',
              st === 0 ? 'border-accent-cyan' : 'border-line',
              st === 0 ? 'text-accent-cyan' : 'text-fg',
            )}
          >
            {st === 0 ? `0 ${loc.dsp.semitones}` : st > 0 ? `+${st}` : st}
          </button>
        ))}
      </div>
    </div>
);
