import type React from 'react';
import { cn } from '../../utils/cn';

export interface SettingRowProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The control on the right (toggle, select, button group). */
  children?: React.ReactNode;
  className?: string;
}

/** One settings card: title and description on the left, its control on the right. */
export function SettingRow({ title, description, children, className }: SettingRowProps) {
  return (
    <div className={cn('glass-card mb-3.5 flex items-center justify-between gap-4 rounded-xl px-5 py-4', className)}>
      <div className="min-w-0">
        <div className="mb-1 text-md font-bold text-fg">{title}</div>
        {description && <div className="text-ui text-fg-secondary">{description}</div>}
      </div>
      {children}
    </div>
  );
}
