import React from 'react';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { Card, SectionHeader } from './Card';
import type { Tone } from './tones';

export interface ToggleCardProps {
  title: string;
  description?: React.ReactNode;
  icon: React.ReactNode;
  tone: Tone;
  /** Status badges shown after the title. */
  badges?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Controls that only apply while the feature is on (sliders, presets). */
  children?: React.ReactNode;
}

/**
 * A feature that is switched on or off (a settings option, a DSP module): the card lights up in
 * its tone while it is on, and its dependent controls render below the header.
 */
export function ToggleCard({ title, description, icon, tone, badges, checked, onChange, children }: ToggleCardProps) {
  return (
    <Card highlight={checked && tone}>
      <SectionHeader
        icon={icon}
        tone={tone}
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
        actions={<ToggleSwitch checked={checked} onChange={onChange} label={title} />}
      />
      {/* Children.toArray drops false/null, so a set of unmet conditions renders no empty gap. */}
      {React.Children.toArray(children).length > 0 && <div className="mt-4">{children}</div>}
    </Card>
  );
}
