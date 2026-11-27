import type React from 'react';
import { RotateCcw } from '../../../components/ui/icons';
import { Badge, Button, Chip, SettingRow, type Tone } from '../../../components/ui';
import { textTones } from '../../../components/ui/tones';
import { cn } from '../../../utils/cn';

export interface ValuePreset {
  label: string;
  value: number;
}

export interface PresetOptionCardProps {
  /** Accent of the readout and of the pressed non-default presets. */
  tone: Tone;
  title: string;
  description: string;
  value: number;
  /** Readout next to the title, e.g. `600 ms`. */
  readout: string;
  defaultValue: number;
  /** Badge text shown while the default is in use. */
  defaultBadge: string;
  /** Text and tooltip of the reset button. */
  resetLabel: string;
  resetTitle: string;
  presets: readonly ValuePreset[];
  onChange: (value: number) => void;
  /** Extra controls between the title and the presets (a slider). */
  children?: React.ReactNode;
  /** Content placed at the end of the preset row (a custom-value field). */
  presetsEnd?: React.ReactNode;
}

/**
 * A numeric engine setting with quick presets and a reset to its default (output buffer, DSP
 * block size), as one row of a `SettingsGroup`. The default preset is green, the others use `tone`.
 */
export function PresetOptionCard({
  tone,
  title,
  description,
  value,
  readout,
  defaultValue,
  defaultBadge,
  resetLabel,
  resetTitle,
  presets,
  onChange,
  children,
  presetsEnd,
}: PresetOptionCardProps) {
  const isDefault = value === defaultValue;
  return (
    <SettingRow
      compact
      title={
        <span className="flex flex-wrap items-center gap-2">
          {title}
          {isDefault && <Badge tone="green">{defaultBadge}</Badge>}
        </span>
      }
      description={description}
      control={
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-lg border border-line bg-black/30 px-2.5 py-0.5 font-mono text-ui font-bold tabular-nums',
              isDefault ? textTones.green : textTones[tone],
            )}
          >
            {readout}
          </span>
          <Button variant="ghost" size="sm" onClick={() => onChange(defaultValue)} disabled={isDefault} title={resetTitle}>
            <RotateCcw size={14} /> {resetLabel}
          </Button>
        </div>
      }
    >
      {children && <div className="mb-3">{children}</div>}
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((preset) => (
          <Chip
            key={preset.value}
            size="xs"
            pressed={value === preset.value}
            tone={preset.value === defaultValue ? 'green' : tone}
            onClick={() => onChange(preset.value)}
          >
            {preset.label}
          </Chip>
        ))}
        {presetsEnd && <div className="ml-auto flex items-center gap-1.5">{presetsEnd}</div>}
      </div>
    </SettingRow>
  );
}
