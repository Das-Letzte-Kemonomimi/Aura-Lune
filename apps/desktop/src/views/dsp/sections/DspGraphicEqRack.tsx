import React from 'react';
import { Activity, Check, ChevronDown, Headphones, Sliders } from 'lucide-react';
import { EQUALIZER_BANDS } from '../../../types/equalizer';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import type { Dispatch, SetStateAction } from 'react';

export type DspGraphicEqRackProps = Pick<DspStudioViewProps, 'loc' | 'getEqPresetDisplayName' | 'selectedEqPreset' | 'eqPresets' | 'handleApplyEqPreset' | 'handleResetEq' | 'setIsAutoEqOpen' | 'setIsParametricEqOpen' | 'setIsDynamicsStudioOpen' | 'handleEqToggle' | 'handleToggleEqAutoStartup' | 'eqAutoStartup' | 'handleEqBandChange'> & {
  setIsEqPresetMenuOpen: Dispatch<SetStateAction<boolean>>;
  isEqPresetMenuOpen: boolean;
  status: PlaybackStatus;
};

export const DspGraphicEqRack: React.FC<DspGraphicEqRackProps> = ({
  eqAutoStartup,
  eqPresets,
  getEqPresetDisplayName,
  handleApplyEqPreset,
  handleEqBandChange,
  handleEqToggle,
  handleResetEq,
  handleToggleEqAutoStartup,
  isEqPresetMenuOpen,
  loc,
  selectedEqPreset,
  setIsAutoEqOpen,
  setIsDynamicsStudioOpen,
  setIsEqPresetMenuOpen,
  setIsParametricEqOpen,
  status,
}) => (
    <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="var(--accent-pink)" /> {loc.dsp.equalizer}
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {loc.dsp.eqDesc}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Wybór presetu EQ - nowoczesne anime glassmorphism dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEqPresetMenuOpen((prev) => !prev);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(20, 24, 44, 0.95)',
                color: '#ffffff',
                border: isEqPresetMenuOpen ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'all 0.18s ease',
              }}
              title={loc.dsp.eqPresets}
            >
              <Sliders size={13} color="var(--accent-pink)" />
              <span>{getEqPresetDisplayName(selectedEqPreset, loc)}</span>
              <ChevronDown
                size={12}
                style={{
                  color: 'var(--text-muted)',
                  transform: isEqPresetMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.18s ease',
                }}
              />
            </button>

            {isEqPresetMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  minWidth: '220px',
                  background: 'rgba(18, 22, 38, 0.98)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-accent)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
                  padding: '6px',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  animation: 'fadeIn 0.15s ease-out',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '4px 8px', fontWeight: 600 }}>
                  {loc.dsp.eqPresets}
                </div>

                {/* Opcja Własny (Custom) jeśli suwaki zostały zmienione ręcznie */}
                {selectedEqPreset &&
                  !eqPresets.some(
                    (p) =>
                      p.name === selectedEqPreset ||
                      getEqPresetDisplayName(p.name, true) === getEqPresetDisplayName(selectedEqPreset, true)
                  ) && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        background: 'rgba(255, 77, 148, 0.12)',
                        color: 'var(--accent-pink)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        marginBottom: '4px',
                      }}
                    >
                      <span>{getEqPresetDisplayName(selectedEqPreset, loc)}</span>
                      <Check size={13} color="var(--accent-pink)" />
                    </div>
                  )}

                {eqPresets.map((preset) => {
                  const isSelected =
                    selectedEqPreset === preset.name ||
                    getEqPresetDisplayName(selectedEqPreset, true) === getEqPresetDisplayName(preset.name, true);
                  const displayName = getEqPresetDisplayName(preset.name, loc);
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyEqPreset(preset.name)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isSelected ? 'rgba(255, 77, 148, 0.15)' : 'transparent',
                        color: isSelected ? 'var(--accent-pink)' : '#fff',
                        fontSize: '0.8rem',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span>{displayName}</span>
                      {isSelected && <Check size={13} color="var(--accent-pink)" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Przycisk Reset EQ */}
          <button
            onClick={handleResetEq}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            {loc.dsp.reset} (0 dB)
          </button>

          {/* Przycisk Bazy Profili Słuchawkowych AutoEQ */}
          <button
            onClick={() => setIsAutoEqOpen(true)}
            title={loc.dsp.autoEqHarmanTooltip}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.45)',
              color: '#60a5fa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Headphones size={13} /> AutoEQ
          </button>

          {/* Przycisk Wielopasmowego Korektora Parametrycznego PEQ */}
          <button
            onClick={() => setIsParametricEqOpen(true)}
            title={loc.parametricEq.subtitle}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: status.parametric_eq_enabled ? 'rgba(168, 85, 247, 0.32)' : 'rgba(168, 85, 247, 0.16)',
              border: status.parametric_eq_enabled ? '1px solid rgba(168, 85, 247, 0.7)' : '1px solid rgba(168, 85, 247, 0.35)',
              color: status.parametric_eq_enabled ? '#f3e8ff' : '#c084fc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: status.parametric_eq_enabled ? '0 0 10px rgba(168, 85, 247, 0.3)' : 'none',
            }}
          >
            <Sliders size={13} /> PEQ Studio
            {status.parametric_eq_enabled && (
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#c084fc',
                  boxShadow: '0 0 6px #e879f9',
                }}
              />
            )}
          </button>

          {/* Przycisk Studia Dynamiki & Lampy (Kompresor / Saturator / Limiter) */}
          <button
            onClick={() => setIsDynamicsStudioOpen(true)}
            title={loc.dsp.dynamicsStudioTooltip}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background:
                status.compressor_enabled || status.saturator_enabled
                  ? 'rgba(236, 72, 153, 0.3)'
                  : 'rgba(236, 72, 153, 0.14)',
              border:
                status.compressor_enabled || status.saturator_enabled
                  ? '1px solid rgba(236, 72, 153, 0.7)'
                  : '1px solid rgba(236, 72, 153, 0.35)',
              color:
                status.compressor_enabled || status.saturator_enabled ? '#fdf4ff' : '#f472b6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow:
                status.compressor_enabled || status.saturator_enabled
                  ? '0 0 10px rgba(236, 72, 153, 0.3)'
                  : 'none',
            }}
          >
            <Activity size={13} /> Dynamics Studio
            {(status.compressor_enabled || status.saturator_enabled) && (
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#ec4899',
                  boxShadow: '0 0 6px #f472b6',
                }}
              />
            )}
          </button>

          {/* Przełącznik Włącz / Wyłącz EQ (Bypass) */}
          <button
            onClick={handleEqToggle}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: status.equalizer_enabled ? 'rgba(255, 77, 148, 0.25)' : 'rgba(255,255,255,0.06)',
              border: status.equalizer_enabled ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
              color: status.equalizer_enabled ? 'var(--accent-pink)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {status.equalizer_enabled ? `● ${loc.dsp.eqEnabled}` : `○ ${loc.dsp.eqBypass}`}
          </button>

          {/* Przełącznik autostartu EQ */}
          <button
            onClick={handleToggleEqAutoStartup}
            title={loc.dsp.eqAutostart}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: eqAutoStartup ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${eqAutoStartup ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
              color: eqAutoStartup ? 'var(--accent-green)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {eqAutoStartup ? `✓ ${loc.dsp.eqAutostartOn}` : `○ ${loc.dsp.eqAutostartOff}`}
          </button>
        </div>
      </div>

      {/* 10 pasm w ergonomicznym układzie 2-kolumnowym */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          background: 'rgba(0,0,0,0.25)',
          padding: '16px',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {EQUALIZER_BANDS.map((band, idx) => {
          const gain = (status.equalizer_bands && status.equalizer_bands[idx]) ?? 0;
          return (
            <div
              key={band.freq}
              style={{
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                background: 'rgba(25, 28, 48, 0.6)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginRight: '6px' }}>
                    {band.freq}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    ({band.label})
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: gain > 0 ? 'rgba(255, 77, 148, 0.2)' : gain < 0 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.06)',
                    color: gain > 0 ? 'var(--accent-pink)' : gain < 0 ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  }}
                >
                  {gain > 0 ? `+${gain.toFixed(1)} dB` : `${gain.toFixed(1)} dB`}
                </span>
              </div>

              <input
                type="range"
                min={-24}
                max={12}
                step={0.5}
                value={gain}
                onChange={(e) => handleEqBandChange(idx, Number(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
);
