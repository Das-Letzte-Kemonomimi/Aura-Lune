import React from 'react';
import type { Translations } from '../../../i18n';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { type ParametricEqPresetDto, type ParametricEqStateDto } from '../../../utils/parametricEqMath';

export type PeqPresetBarProps = {} & {
  selectedPresetName: string;
  handleSelectPreset: (presetName: string) => void;
  loc: Translations;
  presets: ParametricEqPresetDto[];
  state: ParametricEqStateDto;
  handlePreampChange: (val: number) => void;
  maxEffectiveBoost: number;
  handleApplySafePreamp: () => void;
  safePreampDb: number;
};

export const PeqPresetBar: React.FC<PeqPresetBarProps> = ({
  handleApplySafePreamp,
  handlePreampChange,
  handleSelectPreset,
  loc,
  maxEffectiveBoost,
  presets,
  safePreampDb,
  selectedPresetName,
  state,
}) => (
    <div
      style={{
        padding: '12px 24px',
        background: 'rgba(0, 0, 0, 0.25)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      {/* Wybór Presetu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          Preset:
        </span>
        <select
          value={selectedPresetName}
          onChange={(e) => handleSelectPreset(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary, #fff)',
            fontSize: '0.8rem',
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">{loc.parametricEq.customProfile}</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name} style={{ background: '#181e30' }}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Przedwzmacniacz (Preamp) z ochroną przed clippingiem */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Preamp:
          </span>
          <input
            type="range"
            min="-20"
            max="10"
            step="0.5"
            value={state.preamp_db}
            onChange={(e) => handlePreampChange(parseFloat(e.target.value))}
            style={{ width: '100px', cursor: 'pointer' }}
          />
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              fontFamily: 'monospace',
              minWidth: '55px',
              color: state.preamp_db < 0 ? '#60a5fa' : state.preamp_db > 0 ? '#f43f5e' : 'var(--text-muted)',
            }}
          >
            {state.preamp_db > 0 ? `+${state.preamp_db.toFixed(1)}` : state.preamp_db.toFixed(1)} dB
          </span>
        </div>

        {/* Ostrzeżenie przed przesterowaniem */}
        {maxEffectiveBoost > 0.01 ? (
          <button
            onClick={handleApplySafePreamp}
            title={loc.parametricEq.clippingRiskTitle.replace('{0}', maxEffectiveBoost.toFixed(1)).replace('{1}', safePreampDb.toFixed(1))}
            style={{
              padding: '5px 10px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.18)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fbbf24',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <AlertTriangle size={13} />
            {loc.parametricEq.clippingRiskBadge.replace('{0}', maxEffectiveBoost.toFixed(1))}
          </button>
        ) : (
          <span
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--accent-green, #10b981)',
              fontSize: '0.7rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ShieldCheck size={12} /> {loc.parametricEq.headroomOk}
          </span>
        )}
      </div>
    </div>
);
