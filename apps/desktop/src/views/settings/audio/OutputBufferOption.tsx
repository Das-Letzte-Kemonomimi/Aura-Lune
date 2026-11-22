import React from 'react';
import { Layers, RotateCcw } from 'lucide-react';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';

export type OutputBufferOptionProps = Pick<AudioDevicesSettingsViewProps, 'loc' | 'audioBufferMs' | 'onSetAudioBuffer'>;

export const OutputBufferOption: React.FC<OutputBufferOptionProps> = ({
  audioBufferMs,
  loc,
  onSetAudioBuffer,
}) => (
    <div
      className="glass-card"
      style={{
        padding: '18px 20px',
        marginBottom: '14px',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={17} color="var(--accent-cyan)" />
            {loc.settings.audioBufferTitle}
            {audioBufferMs === 600 && (
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', fontWeight: 600 }}>
                {loc.settings.audioBufferDefault}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.4 }}>
            {loc.settings.audioBufferDesc}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: audioBufferMs === 600 ? 'var(--accent-green)' : 'var(--accent-pink)' }}>
            {audioBufferMs} ms
          </span>
          <button
            onClick={() => onSetAudioBuffer(600)}
            disabled={audioBufferMs === 600}
            className="glass-card"
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              opacity: audioBufferMs === 600 ? 0.4 : 1,
              cursor: audioBufferMs === 600 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--accent-green)',
            }}
            title={loc.settings.audioBufferReset}
          >
            <RotateCcw size={12} /> {loc.settings.audioBufferDefaultLabel}
          </button>
        </div>
      </div>

      {/* Suwak + Presety */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px' }}>
        <input
          type="range"
          min={50}
          max={2000}
          step={25}
          value={audioBufferMs}
          onChange={(e) => onSetAudioBuffer(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent-pink)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="number"
            min={50}
            max={4000}
            value={audioBufferMs}
            onChange={(e) => onSetAudioBuffer(Number(e.target.value))}
            style={{
              width: '70px',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
            }}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ms</span>
        </div>
      </div>

      {/* Szybkie presety bufora audio */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
        {[
          { label: '80 ms (Ultra-low)', value: 80 },
          { label: loc.settings.audioBufferPreset250, value: 250 },
          { label: loc.settings.audioBufferPreset600, value: 600, isDefault: true },
          { label: loc.settings.audioBufferPreset1000, value: 1000 },
          { label: loc.settings.audioBufferPreset2000, value: 2000 },
        ].map((preset) => {
          const isActive = audioBufferMs === preset.value;
          return (
            <button
              key={preset.value}
              onClick={() => onSetAudioBuffer(preset.value)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: isActive ? 700 : 500,
                background: isActive
                  ? (preset.isDefault ? 'rgba(16, 185, 129, 0.25)' : 'rgba(236, 72, 153, 0.25)')
                  : 'rgba(255, 255, 255, 0.04)',
                border: isActive
                  ? (preset.isDefault ? '1px solid var(--accent-green)' : '1px solid var(--accent-pink)')
                  : '1px solid var(--border-subtle)',
                color: isActive
                  ? (preset.isDefault ? 'var(--accent-green)' : 'var(--accent-pink)')
                  : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
);
