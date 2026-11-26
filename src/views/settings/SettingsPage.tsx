import React from 'react';
import { Card, SectionHeader, type Tone } from '../../components/ui';
import { iconTileTones } from '../../components/ui/tones';
import { ToggleSwitch } from '../../components/common/ToggleSwitch';
import { cn } from '../../utils/cn';

export interface SettingsPageProps {
  /** Page heading; omit it when the page starts with its own hero card (About). */
  title?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  /** Buttons aligned to the right of the heading. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Column that every settings tab renders in: an optional heading, then evenly spaced cards. */
export function SettingsPage({ title, icon, tone = 'pink', actions, children }: SettingsPageProps) {
  return (
    <div className="mx-auto flex max-w-200 flex-col gap-3.5">
      {title && (
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-3 text-lg font-bold text-fg">
            {icon && (
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', iconTileTones[tone])}>
                {icon}
              </span>
            )}
            {title}
          </h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

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

/** A feature that is switched on or off: the card lights up in its tone while it is on. */
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
