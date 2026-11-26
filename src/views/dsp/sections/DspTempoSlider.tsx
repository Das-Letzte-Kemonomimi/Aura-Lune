import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';
import { Zap } from '../../../components/ui/icons';

export type DspTempoSliderProps = Pick<DspStudioViewProps, 'loc' | 'handleTempoChange' | 'dspCombination' | 'activeTrackKeyBpm'> & {
  status: PlaybackStatus;
  editingTempo: string | null;
  setEditingTempo: Dispatch<SetStateAction<string | null>>;
};

export const DspTempoSlider: React.FC<DspTempoSliderProps> = ({
  activeTrackKeyBpm,
  dspCombination,
  editingTempo,
  handleTempoChange,
  loc,
  setEditingTempo,
  status,
}) => (
    <div className="mb-7">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label className="text-sm font-semibold">{loc.dsp.tempo}:</label>
          <button
            onClick={() => handleTempoChange(Math.max(0.1, Math.round(((status.tempo_ratio ?? 1) - 0.1) * 100) / 100))}
            className="rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-xxs text-fg-muted"
            title="-0.1x"
          >
            -0.1x
          </button>
          <button
            onClick={() => handleTempoChange(Math.max(0.1, Math.round(((status.tempo_ratio ?? 1) - 0.01) * 100) / 100))}
            className="rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-xxs text-fg-muted"
            title="-0.01x"
          >
            -0.01x
          </button>
          <button
            onClick={() => handleTempoChange(Math.min(3.0, Math.round(((status.tempo_ratio ?? 1) + 0.01) * 100) / 100))}
            className="rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-xxs text-fg-muted"
            title="+0.01x"
          >
            +0.01x
          </button>
          <button
            onClick={() => handleTempoChange(Math.min(3.0, Math.round(((status.tempo_ratio ?? 1) + 0.1) * 100) / 100))}
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
                editingTempo !== null
                  ? editingTempo
                  : (status.tempo_ratio ?? 1).toFixed(2)
              }
              onFocus={(e) => {
                setEditingTempo((status.tempo_ratio ?? 1).toFixed(2));
                e.target.select();
              }}
              onChange={(e) => setEditingTempo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const step = e.shiftKey ? 0.01 : 0.1;
                  const clean = (editingTempo ?? `${status.tempo_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                  const current = parseFloat(clean);
                  if (!isNaN(current)) {
                    const next = Math.min(3.0, Math.round((current + step) * 100) / 100);
                    setEditingTempo(next.toFixed(2));
                    handleTempoChange(next);
                  }
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const step = e.shiftKey ? 0.01 : 0.1;
                  const clean = (editingTempo ?? `${status.tempo_ratio ?? 1}`).replace('x', '').replace('X', '').replace(',', '.').trim();
                  const current = parseFloat(clean);
                  if (!isNaN(current)) {
                    const next = Math.max(0.1, Math.round((current - step) * 100) / 100);
                    setEditingTempo(next.toFixed(2));
                    handleTempoChange(next);
                  }
                } else if (e.key === 'Enter') {
                  const clean = (editingTempo ?? '').replace('x', '').replace('X', '').replace(',', '.').trim();
                  const val = parseFloat(clean);
                  if (!isNaN(val)) {
                    const min = status.capabilities?.min_tempo_ratio ?? 0.1;
                    const max = status.capabilities?.max_tempo_ratio ?? 3.0;
                    const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                    handleTempoChange(clamped);
                  }
                  setEditingTempo(null);
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  setEditingTempo(null);
                  e.currentTarget.blur();
                }
              }}
              onBlur={() => {
                if (editingTempo !== null) {
                  const clean = editingTempo.replace('x', '').replace('X', '').replace(',', '.').trim();
                  const val = parseFloat(clean);
                  if (!isNaN(val)) {
                    const min = status.capabilities?.min_tempo_ratio ?? 0.1;
                    const max = status.capabilities?.max_tempo_ratio ?? 3.0;
                    const clamped = Math.max(min, Math.min(max, Math.round(val * 100) / 100));
                    handleTempoChange(clamped);
                  }
                  setEditingTempo(null);
                }
              }}
              placeholder="1.00"
              title={loc.dsp.enterValueTempo}
              className="w-15 cursor-text rounded-md border border-accent-cyan/40 bg-white/8 px-1.5 py-0.5 text-center font-mono text-ui font-bold text-accent-cyan outline-none"
            />
            <span className="font-mono text-sm font-semibold text-accent-cyan">
              x ({Math.round((status.tempo_ratio ?? 1) * 100)}%)
            </span>
          </div>
          {/* Resulting tempo (BPM) below the readout */}
          <div className="flex flex-wrap items-center justify-end gap-1 text-xs font-semibold text-accent-cyan">
            {dspCombination.totalBpm ? (
              <span>
                <Zap size={12} className="icon-inline mr-1" />Tempo: <strong className="text-fg">{dspCombination.totalBpm.toFixed(1)} BPM</strong>
                {activeTrackKeyBpm?.bpm ? ` (${loc.dsp.fromBpm} ${activeTrackKeyBpm.bpm.toFixed(1)})` : ''}
                {dspCombination.hasRate && (
                  <span className="ml-1 text-xxs text-accent-amber">
                    (Σ {dspCombination.totalSpeedRatio.toFixed(2)}x)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-fg-muted">
                <Zap size={12} className="icon-inline mr-1" />Tempo: {dspCombination.totalSpeedRatio.toFixed(2)}x
                {dspCombination.hasRate && ` (${(status.tempo_ratio ?? 1).toFixed(2)}x × rate ${(status.rate_ratio ?? 1).toFixed(2)}x)`}
                {loc.dsp.noBaseBpm}
              </span>
            )}
          </div>
        </div>
      </div>
      <input
        type="range"
        min={status.capabilities?.min_tempo_ratio ?? 0.5}
        max={status.capabilities?.max_tempo_ratio ?? 2.0}
        step={0.01}
        value={status.tempo_ratio ?? 1}
        onChange={(e) => handleTempoChange(Number(e.target.value))}
        className="mb-3 w-full"
      />
      <div className="flex gap-1.5">
        {[0.75, 1.0, 1.25, 1.5, 1.75].map((tr) => (
          <button
            key={tr}
            onClick={() => handleTempoChange(tr)}
            className={cn(
              'flex-1 rounded-lg border px-0 py-2 text-xs font-semibold',
              tr === 1.0 ? 'bg-accent-cyan/20' : 'bg-white/5',
              tr === 1.0 ? 'border-accent-cyan' : 'border-line',
              tr === 1.0 ? 'text-accent-cyan' : 'text-fg',
            )}
          >
            {tr === 1.0 ? '1.0x' : `${tr}x`}
          </button>
        ))}
      </div>
    </div>
);
