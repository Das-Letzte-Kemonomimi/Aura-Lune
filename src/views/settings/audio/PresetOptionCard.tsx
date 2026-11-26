import type React from 'react';
import { RotateCcw } from '../../../components/ui/icons';
import { Badge, Button, Card, Chip, SectionHeader, type Tone } from '../../../components/ui';
import { textTones } from '../../../components/ui/tones';
import { cn } from '../../../utils/cn';

export interface ValuePreset {
  label: string;
  value: number;
}

export interface PresetOptionCardProps {
  icon: React.ReactNode;
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
  /** Extra controls between the header and the presets (a slider) or after them (a number field). */
  children?: React.ReactNode;
  /** Content placed at the end of the preset row (a custom-value field). */
  presetsEnd?: React.ReactNode;
}

/**
 * A numeric engine setting with quick presets and a reset to its default (output buffer, DSP
 * block size). The default preset is green, the others use `tone`.
 */
export function PresetOptionCard({
  icon,
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
    <Card>
      <SectionHeader
        icon={icon}
        tone={tone}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {title}
            {isDefault && <Badge tone="green">{defaultBadge}</Badge>}
          </span>
        }
        description={description}
        actions={
          <>
            <span className={cn('font-mono text-base font-bold', isDefault ? textTones.green : textTones[tone])}>
              {readout}
            </span>
            <Button
              variant="tinted"
              tone="green"
              size="sm"
              onClick={() => onChange(defaultValue)}
              disabled={isDefault}
              title={resetTitle}
            >
              <RotateCcw size={14} /> {resetLabel}
            </Button>
          </>
        }
      />
      {children && <div className="mt-4">{children}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {presets.map((preset) => (
          <Chip
            key={preset.value}
            pressed={value === preset.value}
            tone={preset.value === defaultValue ? 'green' : tone}
            onClick={() => onChange(preset.value)}
          >
            {preset.label}
          </Chip>
        ))}
        {presetsEnd && <div className="ml-auto flex items-center gap-1.5">{presetsEnd}</div>}
      </div>
    </Card>
  );
}
