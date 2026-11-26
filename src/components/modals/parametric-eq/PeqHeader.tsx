import React from 'react';
import type { Translations } from '../../../i18n';
import { X, Sliders, Power, RotateCcw, Upload } from 'lucide-react';
import { type ParametricEqStateDto } from '../../../utils/parametricEqMath';
import type { ParametricEqModalProps } from '../ParametricEqModal';
import type { Dispatch, SetStateAction } from 'react';

export type PeqHeaderProps = Pick<ParametricEqModalProps, 'onClose'> & {
  state: ParametricEqStateDto;
  loc: Translations;
  handleToggleEnabled: () => void;
  handleResetFlat: () => void;
  setIsImportModalOpen: Dispatch<SetStateAction<boolean>>;
};

export const PeqHeader: React.FC<PeqHeaderProps> = ({
  handleResetFlat,
  handleToggleEnabled,
  loc,
  onClose,
  setIsImportModalOpen,
  state,
}) => (
    <div
      style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        background: 'rgba(255, 255, 255, 0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: state.enabled
              ? 'linear-gradient(135deg, #06b6d4, #3b82f6)'
              : 'rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: state.enabled ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.3s ease',
          }}
        >
          <Sliders size={20} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
              Parametric EQ Studio
            </h2>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                background: state.enabled
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(255, 255, 255, 0.08)',
                color: state.enabled ? 'var(--accent-green, #10b981)' : 'var(--text-muted)',
                border: `1px solid ${
                  state.enabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'
                }`,
              }}
            >
              {state.enabled ? loc.parametricEq.enabled.toUpperCase() : loc.parametricEq.bypass.toUpperCase()}
            </span>
          </div>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}
          >
            {loc.parametricEq.subtitle}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Przełącznik Włącz / Bypass */}
        <button
          onClick={handleToggleEnabled}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            background: state.enabled
              ? 'rgba(16, 185, 129, 0.25)'
              : 'rgba(255, 255, 255, 0.06)',
            border: state.enabled
              ? '1px solid var(--accent-green, #10b981)'
              : '1px solid var(--border-subtle)',
            color: state.enabled ? 'var(--accent-green, #10b981)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
        >
          <Power size={14} />
          {state.enabled ? loc.parametricEq.enabled : loc.parametricEq.bypass}
        </button>

        {/* Reset Flat */}
        <button
          onClick={handleResetFlat}
          title={loc.parametricEq.resetAllBands}
          style={{
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <RotateCcw size={13} />
          Reset Flat
        </button>

        {/* Przycisk Import / Export */}
        <button
          onClick={() => setIsImportModalOpen(true)}
          style={{
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'rgba(59, 130, 246, 0.18)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            color: '#60a5fa',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <Upload size={13} />
          Import / Export
        </button>

        {/* Zamknij */}
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={20} />
        </button>
      </div>
    </div>
);
