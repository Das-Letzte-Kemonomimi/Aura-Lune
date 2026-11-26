import React from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Nazwa dostępna dla czytników ekranu. */
  label: string;
  disabled?: boolean;
}

/**
 * Przełącznik-suwak (pigułka z białą gałką) oparty na natywnym checkboxie — działa z klawiatury.
 * The track and knob are styled from the checkbox state (`peer-checked:`), so they can never
 * disagree with what assistive tech reads.
 */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, disabled }) => (
  <label className="relative inline-block h-6.5 w-12 shrink-0 cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-50">
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="peer absolute inset-0 m-0 cursor-[inherit] opacity-0"
    />
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-full bg-white/20 transition-[background-color,box-shadow] duration-250 peer-checked:bg-accent-gradient peer-checked:shadow-halo-sm peer-checked:shadow-accent-purple/45 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-purple"
    />
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-0.75 left-0.75 size-5 rounded-full bg-white shadow-md transition-[translate] duration-250 ease-in-out peer-checked:translate-x-5.5"
    />
  </label>
);
