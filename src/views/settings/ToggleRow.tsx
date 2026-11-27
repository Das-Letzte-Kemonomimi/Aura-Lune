import type React from 'react';
import { useId } from 'react';
import { SettingRow } from '../../components/ui';
import { ToggleSwitch } from '../../components/common/ToggleSwitch';

export interface ToggleRowProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Status badges shown after the title. */
  badges?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Controls that only apply while the option is on; render them conditionally. */
  children?: React.ReactNode;
}

/** A flat on/off setting for a `SettingsGroup`: the title labels the switch, so clicking it toggles. */
export function ToggleRow({ title, description, icon, badges, checked, onChange, disabled, children }: ToggleRowProps) {
  const id = useId();
  return (
    <SettingRow
      compact
      icon={icon}
      title={
        badges ? (
          <span className="flex flex-wrap items-center gap-2">
            {title}
            {badges}
          </span>
        ) : (
          title
        )
      }
      description={description}
      htmlFor={id}
      control={<ToggleSwitch id={id} label={title} checked={checked} onChange={onChange} disabled={disabled} />}
    >
      {children}
    </SettingRow>
  );
}
