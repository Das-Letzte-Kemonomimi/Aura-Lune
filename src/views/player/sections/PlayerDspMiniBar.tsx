import React from 'react';
import { RotateCcw, Sliders } from 'lucide-react';
import type { PlaybackStatus } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';

export type PlayerDspMiniBarProps = Pick<PlayerViewProps, 'handleEngineChange' | 'lastActiveDspEngineRef' | 'loc' | 'handleRestoreOriginalTrack' | 'handlePitchChange' | 'handleTempoChange' | 'setActiveTab'> & {
  status: PlaybackStatus;
};

// Memo: sekcja nie zależy od pozycji odtwarzania — nie renderuje się w każdej klatce statusu.
export const PlayerDspMiniBar: React.FC<PlayerDspMiniBarProps> = React.memo(({
  handleEngineChange,
  handlePitchChange,
  handleRestoreOriginalTrack,
  handleTempoChange,
  lastActiveDspEngineRef,
  loc,
  setActiveTab,
  status,
}) => (
    <div
      className="glass-card"
      style={{
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: '12px',
        background: 'rgba(0,0,0,0.28)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          DSP:
        </span>

        {/* Szybki przełącznik Bypass / DSP */}
        <button
          onClick={() => handleEngineChange(status.engine === 'Bypass' ? (lastActiveDspEngineRef.current || 'RubberBand') : 'Bypass')}
          style={{
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: 700,
            background: status.engine === 'Bypass' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
            color: status.engine === 'Bypass' ? 'var(--accent-green)' : 'var(--accent-pink)',
            border: status.engine === 'Bypass' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          title={status.engine === 'Bypass' ? loc.dsp.enableDspTooltip : loc.dsp.disableDspTooltip}
        >
          {status.engine === 'Bypass' ? '● BYPASS' : `● ${status.engine === 'RubberBand' ? 'Rubber Band' : 'SoundTouch'}`}
        </button>

        {/* Wskaźnik i przycisk powrotu ze stemów (jeśli stemy są aktywne) */}
        {status.is_stems_active && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '8px',
              background: 'rgba(236, 72, 153, 0.2)',
              border: '1px solid rgba(236, 72, 153, 0.45)',
              fontSize: '0.75rem',
              color: '#f43f5e',
              fontWeight: 700,
            }}
          >
            <Sliders size={12} />
            <span>{loc.player.stemMix}</span>
            <button
              onClick={handleRestoreOriginalTrack}
              title={loc.player.returnToOriginalTooltip}
              style={{
                background: 'rgba(255, 255, 255, 0.18)',
                border: '1px solid rgba(255, 255, 255, 0.28)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <RotateCcw size={11} />
              {loc.player.restoreOriginal}
            </button>
          </div>
        )}

        {/* Pitch Chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Pitch:</span>
          <span style={{ color: 'var(--accent-pink)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {status.pitch_semitones > 0 ? `+${status.pitch_semitones.toFixed(1)}` : status.pitch_semitones.toFixed(1)} st
          </span>
          {status.pitch_semitones !== 0 && (
            <button
              onClick={() => handlePitchChange(0)}
              title={loc.dsp.resetPitchTooltip}
              style={{ background: 'none', color: 'var(--text-muted)', padding: '2px', cursor: 'pointer', display: 'flex' }}
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>

        {/* Tempo Chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Tempo:</span>
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {status.tempo_ratio.toFixed(2)}x
          </span>
          {status.tempo_ratio !== 1 && (
            <button
              onClick={() => handleTempoChange(1.0)}
              title={loc.dsp.resetTempoTooltip}
              style={{ background: 'none', color: 'var(--text-muted)', padding: '2px', cursor: 'pointer', display: 'flex' }}
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Szybkie przejście do pełnego korektora DSP */}
      <button
        onClick={() => setActiveTab('dsp')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(168, 85, 247, 0.15)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          color: 'var(--accent-purple)',
          fontSize: '0.78rem',
          fontWeight: 600,
          padding: '5px 12px',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        <Sliders size={13} />
        <span>{loc.nav.dsp} &rarr;</span>
      </button>
    </div>
));
