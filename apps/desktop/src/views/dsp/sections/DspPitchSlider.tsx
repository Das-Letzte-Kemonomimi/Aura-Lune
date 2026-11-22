import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import type { Dispatch, SetStateAction } from 'react';

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
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>{loc.dsp.pitch}:</label>
          <button
            onClick={() => handlePitchChange(Math.max(-24, Math.round(((status.pitch_semitones ?? 0) - 0.1) * 100) / 100))}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            title="-0.1 semitone"
          >
            -0.1
          </button>
          <button
            onClick={() => handlePitchChange(Math.max(-24, Math.round(((status.pitch_semitones ?? 0) - 0.01) * 100) / 100))}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            title="-0.01 semitone"
          >
            -0.01
          </button>
          <button
            onClick={() => handlePitchChange(Math.min(24, Math.round(((status.pitch_semitones ?? 0) + 0.01) * 100) / 100))}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            title="+0.01 semitone"
          >
            +0.01
          </button>
          <button
            onClick={() => handlePitchChange(Math.min(24, Math.round(((status.pitch_semitones ?? 0) + 0.1) * 100) / 100))}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            title="+0.1 semitone"
          >
            +0.1
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
              style={{
                width: '60px',
                padding: '2px 6px',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                textAlign: 'center',
                color: 'var(--accent-pink)',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                borderRadius: '6px',
                outline: 'none',
                cursor: 'text',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-pink)', fontWeight: 600, fontSize: '0.85rem' }}>
              {loc.dsp.semitones} ({Math.round((status.pitch_semitones ?? 0) * 100)} {loc.dsp.cents}) | {(2 ** ((status.pitch_semitones ?? 0) / 12)).toFixed(3)}x
            </span>
          </div>
          {/* Wskaźnik wynikowej tonacji (Key) pod wskaźnikiem */}
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-pink)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {dspCombination.totalKey ? (
              <span>
                🎯 {loc.dsp.keyLabel}: <strong style={{ color: '#fff' }}>{dspCombination.totalKey.camelot}</strong> ({dspCombination.totalKey.keyName})
                {dspCombination.totalKey.centsOffset !== 0 ? ` ${dspCombination.totalKey.centsOffset > 0 ? '+' : ''}${dspCombination.totalKey.centsOffset}¢` : ''}
                {dspCombination.hasRate && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--accent-amber)', marginLeft: '4px' }}>
                    (Σ {dspCombination.totalPitchSemitones > 0 ? `+${dspCombination.totalPitchSemitones.toFixed(2)}` : dspCombination.totalPitchSemitones.toFixed(2)} st)
                  </span>
                )}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
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
        style={{ width: '100%', marginBottom: '12px' }}
      />
      <div style={{ display: 'flex', gap: '6px' }}>
        {[-12, -7, -2, 0, 2, 7, 12].map((st) => (
          <button
            key={st}
            onClick={() => handlePitchChange(st)}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              background: st === 0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: st === 0 ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              color: st === 0 ? 'var(--accent-cyan)' : '#fff',
              cursor: 'pointer',
            }}
          >
            {st === 0 ? `0 ${loc.dsp.semitones}` : st > 0 ? `+${st}` : st}
          </button>
        ))}
      </div>
    </div>
);
