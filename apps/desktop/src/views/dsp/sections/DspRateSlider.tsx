import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import type { Dispatch, SetStateAction } from 'react';

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
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {loc.dsp.speed}:
          </label>
          <button
            onClick={() => handleRateChange(Math.max(0.1, Math.round(((status.rate_ratio ?? 1) - 0.1) * 100) / 100))}
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
            onClick={() => handleRateChange(Math.max(0.1, Math.round(((status.rate_ratio ?? 1) - 0.01) * 100) / 100))}
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
            onClick={() => handleRateChange(Math.min(3.0, Math.round(((status.rate_ratio ?? 1) + 0.01) * 100) / 100))}
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
            onClick={() => handleRateChange(Math.min(3.0, Math.round(((status.rate_ratio ?? 1) + 0.1) * 100) / 100))}
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
              style={{
                width: '60px',
                padding: '2px 6px',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                textAlign: 'center',
                color: 'var(--accent-amber)',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '6px',
                outline: 'none',
                cursor: 'text',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', fontWeight: 600, fontSize: '0.85rem' }}>
              x ({Math.round((status.rate_ratio ?? 1) * 100)}%)
            </span>
          </div>
          {/* Wskaźnik wynikowej tonacji i tempa pod wskaźnikiem */}
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {dspCombination.totalKey ? (
              <span>
                🎯 {loc.dsp.keyLabel}: <strong style={{ color: '#fff' }}>{dspCombination.totalKey.camelot}</strong> ({dspCombination.totalKey.keyName})
                {dspCombination.totalKey.centsOffset !== 0 ? ` ${dspCombination.totalKey.centsOffset > 0 ? '+' : ''}${dspCombination.totalKey.centsOffset}¢` : ''}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                🎯 {loc.dsp.keyLabel}: {(dspCombination.totalPitchSemitones > 0 ? '+' : '') + dspCombination.totalPitchSemitones.toFixed(2)} st
              </span>
            )}
            <span>•</span>
            {dspCombination.totalBpm ? (
              <span>
                ⚡ Tempo: <strong style={{ color: '#fff' }}>{dspCombination.totalBpm.toFixed(1)} BPM</strong>
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
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
        style={{ width: '100%', marginBottom: '12px' }}
      />
      <div style={{ display: 'flex', gap: '6px' }}>
        {[0.8, 0.9, 1.0, 1.1, 1.25].map((r) => (
          <button
            key={r}
            onClick={() => handleRateChange(r)}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              background: r === 1.0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: r === 1.0 ? '1px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
              color: r === 1.0 ? 'var(--accent-amber)' : '#fff',
              cursor: 'pointer',
            }}
          >
            {r === 1.0 ? '1.0x' : `${r}x`}
          </button>
        ))}
      </div>
    </div>
);
