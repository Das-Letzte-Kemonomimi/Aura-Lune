import React from 'react';
import { Activity, RotateCcw } from 'lucide-react';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';

export type DspBlockSizeOptionProps = Pick<AudioDevicesSettingsViewProps, 'loc' | 'dspBlockSize' | 'onSetDspBlockSize'>;

export const DspBlockSizeOption: React.FC<DspBlockSizeOptionProps> = ({
  dspBlockSize,
  loc,
  onSetDspBlockSize,
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
            <Activity size={17} color="var(--accent-pink)" />
            {loc.settings.dspBlockSizeTitle}
            {dspBlockSize === 2048 && (
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', fontWeight: 600 }}>
                {loc.settings.dspBlockSizeDefault}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.4 }}>
            {loc.settings.dspBlockSizeDesc}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: dspBlockSize === 2048 ? 'var(--accent-green)' : 'var(--accent-cyan)' }}>
            {dspBlockSize} {loc.settings.dspBlockSizeFrames}
          </span>
          <button
            onClick={() => onSetDspBlockSize(2048)}
            disabled={dspBlockSize === 2048}
            className="glass-card"
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              opacity: dspBlockSize === 2048 ? 0.4 : 1,
              cursor: dspBlockSize === 2048 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--accent-green)',
            }}
            title={loc.settings.dspBlockSizeReset}
          >
            <RotateCcw size={12} /> {loc.settings.dspBlockSizeDefaultLabel}
          </button>
        </div>
      </div>

      {/* Szybkie presety bloku DSP */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { label: loc.settings.dspBlockPreset512, value: 512 },
          { label: loc.settings.dspBlockPreset1024, value: 1024 },
          { label: loc.settings.dspBlockPreset2048, value: 2048, isDefault: true },
          { label: loc.settings.dspBlockPreset4096, value: 4096 },
          { label: loc.settings.dspBlockPreset8192, value: 8192 },
        ].map((preset) => {
          const isActive = dspBlockSize === preset.value;
          return (
            <button
              key={preset.value}
              onClick={() => onSetDspBlockSize(preset.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: isActive ? 700 : 500,
                background: isActive
                  ? (preset.isDefault ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.25)')
                  : 'rgba(255, 255, 255, 0.04)',
                border: isActive
                  ? (preset.isDefault ? '1px solid var(--accent-green)' : '1px solid var(--accent-cyan)')
                  : '1px solid var(--border-subtle)',
                color: isActive
                  ? (preset.isDefault ? 'var(--accent-green)' : 'var(--accent-cyan)')
                  : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {preset.label}
            </button>
          );
        })}

        {/* Pole ręcznego wpisania dowolnej wielkości */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {loc.settings.dspBlockCustom}
          </span>
          <input
            type="number"
            min={256}
            max={16384}
            step={256}
            value={dspBlockSize}
            onChange={(e) => onSetDspBlockSize(Number(e.target.value))}
            style={{
              width: '80px',
              padding: '5px 8px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
            }}
          />
        </div>
      </div>
    </div>
);
