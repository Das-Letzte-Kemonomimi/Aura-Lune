import type React from 'react';
import { PageHeader, type Tone } from '../../components/ui';

export interface SettingsPageProps {
  /** Page heading; omit it when the page starts with its own hero (About). */
  title?: React.ReactNode;
  icon?: React.ReactNode;
  /** Accent of the heading tile: the tone of the tab's navigation group. */
  tone?: Tone;
  /** Buttons aligned to the right of the heading. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Column that every settings tab renders in: an optional heading, then evenly spaced groups. */
export function SettingsPage({ title, icon, tone = 'pink', actions, children }: SettingsPageProps) {
  return (
    <div className="mx-auto flex max-w-200 flex-col gap-6">
      {title && <PageHeader title={title} icon={icon} tone={tone} actions={actions} />}
      {children}
    </div>
  );
}
