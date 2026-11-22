import React from 'react';
import { Sparkles } from 'lucide-react';
import type { DspStudioViewProps } from '../DspStudioView';

export type DspReverbPanelProps = Pick<DspStudioViewProps, 'reverbEnabled' | 'loc' | 'handleUpdateReverb' | 'reverbRoomSize' | 'reverbDamping' | 'reverbWidth' | 'reverbLevel' | 'handleTempoChange' | 'handlePitchChange' | 'showMessage'>;

export const DspReverbPanel: React.FC<DspReverbPanelProps> = ({
  handlePitchChange,
  handleTempoChange,
  handleUpdateReverb,
  loc,
  reverbDamping,
  reverbEnabled,
  reverbLevel,
  reverbRoomSize,
  reverbWidth,
  showMessage,
}) => (
    <div
      style={{
        background: 'rgba(0, 0, 0, 0.28)',
        padding: '20px',
        borderRadius: '16px',
        border: `1px solid ${reverbEnabled ? 'rgba(168, 85, 247, 0.4)' : 'var(--border-subtle)'}`,
        marginBottom: '28px',
        boxShadow: reverbEnabled ? '0 4px 20px rgba(168, 85, 247, 0.15)' : 'none',
        transition: 'all 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={20} color={reverbEnabled ? 'var(--accent-purple)' : 'var(--text-muted)'} />
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
              {loc.dsp.spatialReverbTitle}
            </h4>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {loc.dsp.spatialReverbDesc}
            </span>
          </div>
        </div>

        <button
          onClick={() => handleUpdateReverb(!reverbEnabled)}
          style={{
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.76rem',
            fontWeight: 700,
            background: reverbEnabled ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.06)',
            border: `1px solid ${reverbEnabled ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
            color: reverbEnabled ? 'var(--accent-purple)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          {reverbEnabled ? '● REVERB ON' : '○ REVERB BYPASS'}
        </button>
      </div>

      {/* Suwaki parametrów Reverb */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', opacity: reverbEnabled ? 1 : 0.45 }}>
        {/* Rozmiar pomieszczenia (Room Size) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Room Size (Rozmiar):</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbRoomSize * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={!reverbEnabled}
            value={reverbRoomSize}
            onChange={(e) => handleUpdateReverb(true, Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Tłumienie (Damping) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{loc.dsp.dampingLabel}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbDamping * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={!reverbEnabled}
            value={reverbDamping}
            onChange={(e) => handleUpdateReverb(true, undefined, Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Szerokość stereo (Width) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{loc.dsp.stereoWidthLabel}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbWidth * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={!reverbEnabled}
            value={reverbWidth}
            onChange={(e) => handleUpdateReverb(true, undefined, undefined, Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Poziom pogłosu (Wet Level) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Wet Level (Nasycenie):</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(reverbLevel * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={!reverbEnabled}
            value={reverbLevel}
            onChange={(e) => handleUpdateReverb(true, undefined, undefined, undefined, Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Szybkie presety pogłosu */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          Presety:
        </span>
        <button
          onClick={() => handleUpdateReverb(true, 0.40, 0.50, 0.70, 0.25)}
          style={{
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Small Room
        </button>
        <button
          onClick={() => handleUpdateReverb(true, 0.70, 0.30, 0.90, 0.35)}
          style={{
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Ambient Hall
        </button>
        <button
          onClick={() => handleUpdateReverb(true, 0.85, 0.15, 1.0, 0.45)}
          style={{
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Cathedral
        </button>
        {/* Wymarzony profil użytkowniczki: Slowed + Reverb */}
        <button
          onClick={() => {
            handleTempoChange(0.82);
            handlePitchChange(-2.0);
            handleUpdateReverb(true, 0.75, 0.35, 1.0, 0.40);
            showMessage('Aktywowano profil: Slowed + Reverb 🌌');
          }}
          style={{
            padding: '4px 12px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.3), rgba(168, 85, 247, 0.3))',
            border: '1px solid var(--accent-pink)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          🌌 Slowed + Reverb
        </button>
      </div>
    </div>
);
