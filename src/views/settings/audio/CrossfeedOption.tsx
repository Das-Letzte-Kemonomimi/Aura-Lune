import React from 'react';
import { Headphones } from 'lucide-react';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';

export type CrossfeedOptionProps = Pick<AudioDevicesSettingsViewProps, 'crossfeedEnabled' | 'loc' | 'onSetCrossfeed' | 'crossfeedPreset' | 'crossfeedFcut' | 'crossfeedFeed'>;

export const CrossfeedOption: React.FC<CrossfeedOptionProps> = ({
  crossfeedEnabled,
  crossfeedFcut,
  crossfeedFeed,
  crossfeedPreset,
  loc,
  onSetCrossfeed,
}) => (
    <div
      className="glass-card"
      style={{
        padding: '18px 20px',
        marginBottom: '14px',
        borderRadius: '12px',
        border: crossfeedEnabled ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid var(--border-subtle)',
        background: crossfeedEnabled ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.03)',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Headphones size={18} color="var(--accent-cyan, #06b6d4)" />
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
            {loc.settings.crossfeedTitle}
          </span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={crossfeedEnabled}
            onChange={(e) => onSetCrossfeed(e.target.checked, crossfeedPreset)}
            style={{ accentColor: 'var(--accent-cyan, #06b6d4)', width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: crossfeedEnabled ? 'var(--accent-cyan, #06b6d4)' : 'var(--text-muted)' }}>
            {crossfeedEnabled ? loc.settings.crossfeedActive : loc.settings.crossfeedOff}
          </span>
        </label>
      </div>

      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        {loc.settings.crossfeedDesc}
      </div>

      {/* Wybór presetu: Default / ChuMoy / JanMeier / Custom */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '14px', opacity: crossfeedEnabled ? 1 : 0.45, pointerEvents: crossfeedEnabled ? 'auto' : 'none' }}>
        {([
          { id: 'Default', label: loc.settings.crossfeedPresetDefault },
          { id: 'ChuMoy', label: loc.settings.crossfeedPresetChuMoy },
          { id: 'JanMeier', label: loc.settings.crossfeedPresetJanMeier },
          { id: 'Custom', label: loc.settings.crossfeedPresetCustom },
        ] as const).map((p) => {
          const isActive = crossfeedPreset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSetCrossfeed(crossfeedEnabled, p.id)}
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: isActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: isActive ? '1px solid rgba(99, 102, 241, 0.6)' : '1px solid var(--border-subtle)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Suwaki częstotliwości i feedu */}
      <div style={{ opacity: crossfeedEnabled ? 1 : 0.45, pointerEvents: crossfeedEnabled && crossfeedPreset === 'Custom' ? 'auto' : 'none', transition: 'opacity 0.2s ease', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {loc.settings.crossfeedFcut}
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
              {crossfeedFcut} Hz
            </span>
          </div>
          <input
            type="range"
            min="300"
            max="2000"
            step="25"
            value={crossfeedFcut}
            onChange={(e) => onSetCrossfeed(crossfeedEnabled, 'Custom', parseInt(e.target.value, 10), crossfeedFeed)}
            style={{ width: '100%', accentColor: 'var(--accent-cyan, #06b6d4)' }}
          />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {loc.settings.crossfeedFeed}
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
              {(crossfeedFeed / 10).toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="150"
            step="5"
            value={crossfeedFeed}
            onChange={(e) => onSetCrossfeed(crossfeedEnabled, 'Custom', crossfeedFcut, parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: 'var(--accent-cyan, #06b6d4)' }}
          />
        </div>
      </div>
    </div>
);
