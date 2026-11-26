import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';

export type DspRateSliderProps = Pick<DspStudioViewProps, 'loc' | 'handleRateChange' | 'dspCombination'> & {
  status: PlaybackStatus;
  editingRate: string | null;
  setEditingRate: Dispatch<SetStateAction<string | null>>;
};

export const DspRateSlider: React.FC<DspRateSliderProps> = ({
  dspCombination,
  editingRate,
  handleRateChange,
  loc,
  setEditingRate,
  status,
}) => (
    <div className="mb-7">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-sm font-semibold">
            {loc.dsp.speed}:
          </label>
          <button
            onClick={() => handleRateChange(Math.max(0.1, Math.round(((status.rate_ratio ?? 1) - 0.1) * 100) / 100))}
            className="rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-xxs text-fg-muted"
            title="-0.1x"
          >
            -0.1x
          </button>
          <button
            onClick={() => handleRateChange(Math.max(0.1, Math.round(((status.rate_ratio ?? 1) - 0.01) * 100) / 100))}
            className="rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-xxs text-fg-muted"
            title="-0.01x"
          >
            -0.01x
          </button>
          <button
            onClick={() => handleRateChange(Math.min(3.0, Math.round(((status.rate_ratio ?? 1) + 0.01) * 100) / 100))}
            className="rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-xxs text-fg-muted"
            title="+0.01x"
          >
            +0.01x
          </button>
          <button
            onClick={() => handleRateChange(Math.min(3.0, Math.round(((status.rate_ratio ?? 1) + 0.1) * 100) / 100))}
            className="rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-xxs text-fg-muted"
            title="+0.1x"
          >
            +0.1x
          </button>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={
                editingRate !== null
                  ? editingRate
                  : (status.rate_ratio ?? 1).toFixed(2)
              }
              onFocus={(e) => {
                setEditingRate((status.rate_ratio ?? 1).toFixed(2));
                e.target.select();
              }}
              onChange={(e) => setEditingRate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const step = e.shiftKey ? 0.01 : 0.1;
                  const clean = (editingRate ?? `${status.rate_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                  const current = parseFloat(clean);
                  if (!isNaN(current)) {
                    const next = Math.min(3.0, Math.round((current + step) * 100) / 100);
                    setEditingRate(next.toFixed(2));
                    handleRateChange(next);
                  }
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const step = e.shiftKey ? 0.01 : 0.1;
                  const clean = (editingRate ?? `${status.rate_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                  const current = parseFloat(clean);
                  if (!isNaN(current)) {
                    const next = Math.max(0.1, Math.round((current - step) * 100) / 100);
                    setEditingRate(next.toFixed(2));
                    handleRateChange(next);
                  }
                } else if (e.key === 'Enter') {
                  const clean = (editingRate ?? '').replace('x', '').replace('X', '').replace(',', '.').trim();
                  const val = parseFloat(clean);
                  if (!isNaN(val)) {
                    const clamped = Math.max(0.1, Math.min(3.0, Math.round(val * 100) / 100));
                    handleRateChange(clamped);
                  }
                  setEditingRate(null);
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  setEditingRate(null);
                  e.currentTarget.blur();
                }
              }}
              onBlur={() => {
                if (editingRate !== null) {
                  const clean = editingRate.replace('x', '').replace('X', '').replace(',', '.').trim();
                  const val = parseFloat(clean);
                  if (!isNaN(val)) {
                    const clamped = Math.max(0.1, Math.min(3.0, Math.round(val * 100) / 100));
                    handleRateChange(clamped);
                  }
                  setEditingRate(null);
                }
              }}
              placeholder="1.00"
              title={loc.dsp.enterValueSpeed}
              className="w-15 cursor-text rounded-md border border-accent-amber/40 bg-white/8 px-1.5 py-0.5 text-center font-mono text-ui font-bold text-accent-amber outline-none"
            />
            <span className="font-mono text-sm font-semibold text-accent-amber">
              x ({Math.round((status.rate_ratio ?? 1) * 100)}%)
            </span>
          </div>
          {/* Resulting key and tempo below the readout */}
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold text-accent-amber">
            {dspCombination.totalKey ? (
              <span>
                🎯 {loc.dsp.keyLabel}: <strong className="text-fg">{dspCombination.totalKey.camelot}</strong> ({dspCombination.totalKey.keyName})
                {dspCombination.totalKey.centsOffset !== 0 ? ` ${dspCombination.totalKey.centsOffset > 0 ? '+' : ''}${dspCombination.totalKey.centsOffset}¢` : ''}
              </span>
            ) : (
              <span className="text-fg-muted">
                🎯 {loc.dsp.keyLabel}: {(dspCombination.totalPitchSemitones > 0 ? '+' : '') + dspCombination.totalPitchSemitones.toFixed(2)} st
              </span>
            )}
            <span>•</span>
            {dspCombination.totalBpm ? (
              <span>
                ⚡ Tempo: <strong className="text-fg">{dspCombination.totalBpm.toFixed(1)} BPM</strong>
              </span>
            ) : (
              <span className="text-fg-muted">
                ⚡ Tempo: {dspCombination.totalSpeedRatio.toFixed(2)}x
              </span>
            )}
          </div>
        </div>
      </div>
      <input
        type="range"
        min={0.5}
        max={2.0}
        step={0.01}
        value={status.rate_ratio ?? 1}
        onChange={(e) => handleRateChange(Number(e.target.value))}
        className="mb-3 w-full"
      />
      <div className="flex gap-1.5">
        {[0.8, 0.9, 1.0, 1.1, 1.25].map((r) => (
          <button
            key={r}
            onClick={() => handleRateChange(r)}
            className={cn(
              'flex-1 rounded-lg border px-0 py-2 text-xs font-semibold',
              r === 1.0 ? 'bg-accent-amber/20' : 'bg-white/5',
              r === 1.0 ? 'border-accent-amber' : 'border-line',
              r === 1.0 ? 'text-accent-amber' : 'text-fg',
            )}
          >
            {r === 1.0 ? '1.0x' : `${r}x`}
          </button>
        ))}
      </div>
    </div>
);
