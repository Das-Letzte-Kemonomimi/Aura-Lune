import React from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Nazwa dostępna dla czytników ekranu. */
  label: string;
  disabled?: boolean;
}

/** Przełącznik-suwak (pigułka z białą gałką) oparty na natywnym checkboxie — działa z klawiatury. */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, disabled }) => (
  <label
    style={{
      position: 'relative',
      display: 'inline-block',
      width: '48px',
      height: '26px',
      flexShrink: 0,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}
  >
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      style={{ position: 'absolute', inset: 0, opacity: 0, margin: 0, cursor: 'inherit' }}
    />
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '26px',
        background: checked ? 'linear-gradient(135deg, #5b5bf0, #6d5df5)' : 'rgba(255,255,255,0.2)',
        boxShadow: checked ? '0 0 10px rgba(99, 102, 241, 0.45)' : 'none',
        transition: 'background 0.25s, box-shadow 0.25s',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '3px',
          left: checked ? '25px' : '3px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </span>
  </label>
);
