import React from 'react';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';

export type DspEngineSelectorProps = Pick<DspStudioViewProps, 'loc' | 'handleEngineChange'> & {
  status: PlaybackStatus;
};

export const DspEngineSelector: React.FC<DspEngineSelectorProps> = ({
  handleEngineChange,
  loc,
  status,
}) => (
    <div style={{ marginBottom: '24px' }}>
      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '10px', fontWeight: 600 }}>
        {loc.dsp.engine}:
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {/* Karta Bypass (Bez DSP / Czysty dźwięk) */}
        <div
          onClick={() => handleEngineChange('Bypass')}
          className="glass-card"
          style={{
            padding: '16px',
            cursor: 'pointer',
            borderRadius: '14px',
            border: status.engine === 'Bypass' ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)',
            background: status.engine === 'Bypass' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{loc.dsp.bypass}</span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.2)',
                color: 'var(--accent-green)',
              }}
            >
              DIRECT
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {loc.dsp.bypassDesc}
          </p>
        </div>

        {/* Karta Rubber Band */}
        <div
          onClick={() => handleEngineChange('RubberBand')}
          className="glass-card"
          style={{
            padding: '16px',
            cursor: 'pointer',
            borderRadius: '14px',
            border: status.engine === 'RubberBand' ? '2px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
            background: status.engine === 'RubberBand' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{loc.dsp.rubberband}</span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(244, 63, 94, 0.2)',
                color: 'var(--accent-pink)',
              }}
            >
              HI-FI (MSC)
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {loc.dsp.rubberbandDesc}
          </p>
        </div>

        {/* Karta SoundTouch */}
        <div
          onClick={() => handleEngineChange('SoundTouch')}
          className="glass-card"
          style={{
            padding: '16px',
            cursor: 'pointer',
            borderRadius: '14px',
            border: status.engine === 'SoundTouch' ? '2px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
            background: status.engine === 'SoundTouch' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{loc.dsp.soundtouch}</span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.2)',
                color: 'var(--accent-cyan)',
              }}
            >
              LOW CPU
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {loc.dsp.soundtouchDesc}
          </p>
        </div>
      </div>
    </div>
);
