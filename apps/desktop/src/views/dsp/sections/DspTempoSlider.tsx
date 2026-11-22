import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import type { Dispatch, SetStateAction } from 'react';

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
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>{loc.dsp.tempo}:</label>
          <button
            onClick={() => handleTempoChange(Math.max(0.1, Math.round(((status.tempo_ratio ?? 1) - 0.1) * 100) / 100))}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            title="-0.1x"
          >
            -0.1x
          </button>
          <button
            onClick={() => handleTempoChange(Math.max(0.1, Math.round(((status.tempo_ratio ?? 1) - 0.01) * 100) / 100))}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            title="-0.01x"
          >
            -0.01x
          </button>
          <button
            onClick={() => handleTempoChange(Math.min(3.0, Math.round(((status.tempo_ratio ?? 1) + 0.01) * 100) / 100))}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            title="+0.01x"
          >
            +0.01x
          </button>
          <button
            onClick={() => handleTempoChange(Math.min(3.0, Math.round(((status.tempo_ratio ?? 1) + 0.1) * 100) / 100))}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            title="+0.1x"
          >
            +0.1x
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
              style={{
                width: '60px',
                padding: '2px 6px',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                textAlign: 'center',
                color: 'var(--accent-cyan)',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                borderRadius: '6px',
                outline: 'none',
                cursor: 'text',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.85rem' }}>
              x ({Math.round((status.tempo_ratio ?? 1) * 100)}%)
            </span>
          </div>
          {/* Wskaźnik wynikowego tempa (BPM) pod wskaźnikiem */}
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {dspCombination.totalBpm ? (
              <span>
                ⚡ Tempo: <strong style={{ color: '#fff' }}>{dspCombination.totalBpm.toFixed(1)} BPM</strong>
                {activeTrackKeyBpm?.bpm ? ` (${loc.dsp.fromBpm} ${activeTrackKeyBpm.bpm.toFixed(1)})` : ''}
                {dspCombination.hasRate && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--accent-amber)', marginLeft: '4px' }}>
                    (Σ {dspCombination.totalSpeedRatio.toFixed(2)}x)
                  </span>
                )}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                ⚡ Tempo: {dspCombination.totalSpeedRatio.toFixed(2)}x
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
        style={{ width: '100%', marginBottom: '12px' }}
      />
      <div style={{ display: 'flex', gap: '6px' }}>
        {[0.75, 1.0, 1.25, 1.5, 1.75].map((tr) => (
          <button
            key={tr}
            onClick={() => handleTempoChange(tr)}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              background: tr === 1.0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: tr === 1.0 ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              color: tr === 1.0 ? 'var(--accent-cyan)' : '#fff',
              cursor: 'pointer',
            }}
          >
            {tr === 1.0 ? '1.0x' : `${tr}x`}
          </button>
        ))}
      </div>
    </div>
);
