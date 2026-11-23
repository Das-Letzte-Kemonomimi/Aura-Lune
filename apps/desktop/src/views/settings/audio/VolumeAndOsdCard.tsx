import React from 'react';
import { Volume2 } from 'lucide-react';
import { type VolumeOsdPosition } from '../../../components/player/VolumeOsd';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';
import { DB_STEP_OPTIONS } from '../../../utils/volumeScale';
import { fmt } from '../../../utils/fmt';

export type VolumeAndOsdCardProps = Pick<AudioDevicesSettingsViewProps, 'loc' | 'instantVolume' | 'onToggleInstantVolume' | 'volumeUnit' | 'onSetVolumeUnit' | 'volumeDbStep' | 'onSetVolumeDbStep' | 'volumeOsdPosition' | 'onSetVolumeOsdPosition' | 'onToggleRecapOptIn' | 'recapOptIn'>;

export const VolumeAndOsdCard: React.FC<VolumeAndOsdCardProps> = ({
  instantVolume,
  loc,
  onSetVolumeOsdPosition,
  onSetVolumeUnit,
  onSetVolumeDbStep,
  onToggleInstantVolume,
  onToggleRecapOptIn,
  recapOptIn,
  volumeDbStep,
  volumeOsdPosition,
  volumeUnit,
}) => (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '14px', borderRadius: '12px' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Volume2 size={18} color="var(--accent-cyan)" /> {loc.settings.volumeSectionTitle}
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.84rem' }}>
        {/* Tryb głośności: Natychmiastowy vs Płynny */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#fff' }}>
              {loc.settings.volumeSliderResponse}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {instantVolume
                ? loc.settings.volumeSliderInstantDesc
                : loc.settings.volumeSliderSmoothDesc}
            </div>
          </div>
          <button
            onClick={onToggleInstantVolume}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.76rem',
              fontWeight: 700,
              background: instantVolume ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${instantVolume ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
              color: instantVolume ? 'var(--accent-cyan)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {instantVolume ? loc.settings.volumeSliderInstant : loc.settings.volumeSliderSmooth}
          </button>
        </div>

        {/* Jednostka wyświetlania głośności: Procenty vs Decybele */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#fff' }}>
              {loc.settings.volumeUnitTitle}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {volumeUnit === 'db' ? loc.settings.volumeUnitDb : loc.settings.volumeUnitPercent}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => onSetVolumeUnit('percent')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: volumeUnit === 'percent' ? 'var(--accent-pink)' : 'transparent',
                color: volumeUnit === 'percent' ? '#fff' : 'var(--text-muted)',
              }}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => onSetVolumeUnit('db')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: volumeUnit === 'db' ? 'var(--accent-cyan)' : 'transparent',
                color: volumeUnit === 'db' ? '#fff' : 'var(--text-muted)',
              }}
            >
              dB
            </button>
          </div>
        </div>

        {/* Krok trybu dB: ile dB na każde 5% suwaka — dostępne tylko, gdy włączona jest jednostka dB */}
        {volumeUnit === 'db' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff' }}>
                {loc.settings.volumeDbStepTitle}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {fmt(loc.settings.volumeDbStepDesc, String(volumeDbStep))}
              </div>
            </div>
            <div
              role="group"
              aria-label={loc.settings.volumeDbStepTitle}
              style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}
            >
              {DB_STEP_OPTIONS.map((step) => (
                <button
                  key={step}
                  type="button"
                  aria-pressed={volumeDbStep === step}
                  onClick={() => onSetVolumeDbStep(step)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    fontFamily: 'var(--font-mono)',
                    background: volumeDbStep === step ? 'var(--accent-cyan)' : 'transparent',
                    color: volumeDbStep === step ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  -{step.toFixed(1)} dB
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pozycja OSD głośności */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#fff' }}>
              {loc.settings.volumeOsdPosTitle}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {loc.settings.volumeOsdPosDesc}
            </div>
          </div>
          <select
            value={volumeOsdPosition}
            onChange={(e) => onSetVolumeOsdPosition(e.target.value as VolumeOsdPosition)}
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              background: 'rgba(20, 24, 44, 0.95)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 30px 6px 12px',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23f43f5e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
            }}
          >
            <option value="bottom-center" style={{ background: '#121420' }}>{loc.settings.volumeOsdBottomCenter}</option>
            <option value="center" style={{ background: '#121420' }}>{loc.settings.volumeOsdCenter}</option>
            <option value="top-right" style={{ background: '#121420' }}>{loc.settings.volumeOsdTopRight}</option>
            <option value="top-left" style={{ background: '#121420' }}>{loc.settings.volumeOsdTopLeft}</option>
            <option value="bottom-right" style={{ background: '#121420' }}>{loc.settings.volumeOsdBottomRight}</option>
            <option value="bottom-left" style={{ background: '#121420' }}>{loc.settings.volumeOsdBottomLeft}</option>
            <option value="off" style={{ background: '#121420' }}>{loc.settings.volumeOsdOff}</option>
          </select>
        </div>

        {/* Zgoda na Auralune Recap (Opt-In) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#fff' }}>
              {loc.settings.recapTitle}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {loc.settings.recapDesc}
            </div>
          </div>
          <button
            onClick={onToggleRecapOptIn}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.76rem',
              fontWeight: 700,
              background: recapOptIn ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${recapOptIn ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
              color: recapOptIn ? 'var(--accent-pink)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {recapOptIn ? loc.settings.recapEnabled : loc.settings.recapDisabled}
          </button>
        </div>
      </div>
    </div>
);
