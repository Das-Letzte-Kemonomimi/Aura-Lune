import type React from 'react';
import { useId } from 'react';
import { cn } from '../../utils/cn';
import { Card } from './Card';

export interface SettingsGroupProps {
  /** Eyebrow label above the list. */
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Controls aligned to the right of the eyebrow (a reset button, a status badge). */
  actions?: React.ReactNode;
  /** `SettingRow`s (or any block): they are separated by hairlines and carry no border of their own. */
  children: React.ReactNode;
  className?: string;
}

/** A labelled group of settings: an uppercase eyebrow over a flat inset list of rows. */
export function SettingsGroup({ label, description, actions, children, className }: SettingsGroupProps) {
  const labelId = useId();
  return (
    <section aria-labelledby={labelId} className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 id={labelId} className="label-caps text-fg-muted">
            {label}
          </h3>
          {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <Card variant="inset" padding="none" className="divide-y divide-line">
        {children}
      </Card>
    </section>
  );
}
