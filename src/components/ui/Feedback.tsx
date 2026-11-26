import type React from 'react';
import { cn } from '../../utils/cn';
import { Loader2 } from './icons';
import { solidTones, textTones, type Tone, type ToneOrNeutral } from './tones';

const spinnerSizes = { sm: 14, md: 18, lg: 28 } as const;

export interface SpinnerProps {
  size?: keyof typeof spinnerSizes;
  tone?: ToneOrNeutral;
  /** Accessible text ("Loading…"). Without it the spinner is decorative. */
  label?: string;
  className?: string;
}

/** Loading indicator. Spins only when the user allows motion. */
export function Spinner({ size = 'md', tone = 'pink', label, className }: SpinnerProps) {
  return (
    <Loader2
      size={spinnerSizes[size]}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0 motion-safe:animate-spin', textTones[tone], className)}
    />
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A call to action (usually a `Button`). */
  action?: React.ReactNode;
  className?: string;
}

/** Placeholder for an empty list or view. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-white/5 text-fg-muted">{icon}</div>
      )}
      <div className="text-md font-semibold text-fg">{title}</div>
      {description && <p className="max-w-sm text-xs text-fg-muted">{description}</p>}
      {action}
    </div>
  );
}

export interface StatusDotProps {
  tone?: ToneOrNeutral;
  /** Pulse to show live activity (only when the user allows motion). */
  pulse?: boolean;
  /** Accessible text; without it the dot is decorative. */
  label?: string;
  className?: string;
}

/** Small coloured dot for online / active / error states. */
export function StatusDot({ tone = 'green', pulse, label, className }: StatusDotProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        solidTones[tone],
        pulse && 'motion-safe:animate-pulse',
        className,
      )}
    />
  );
}

export interface ProgressBarProps {
  /** Progress from 0 to 100; values outside are clamped. */
  value: number;
  /** Solid colour; without it the bar uses the brand gradient. */
  tone?: Tone;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

/** Horizontal progress bar. */
export function ProgressBar({ value, tone, size = 'md', label, className }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn('w-full overflow-hidden rounded-full bg-white/10', size === 'sm' ? 'h-1' : 'h-1.5', className)}
    >
      <div
        className={cn('h-full rounded-full', tone ? solidTones[tone] : 'bg-accent-gradient')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
