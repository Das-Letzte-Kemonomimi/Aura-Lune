import type React from 'react';
import { cn } from '../../utils/cn';
import { calloutTones, textTones, type Tone } from './tones';

/** A tone, or `danger` (the same as `red`) for errors. */
export type CalloutTone = Tone | 'danger';

export interface CalloutProps extends React.ComponentProps<'div'> {
  tone?: CalloutTone;
  /** Icon shown before the content, in the tone's accent colour. */
  icon?: React.ReactNode;
}

/** Tinted info/status box ("timer active", "end of track", warnings, errors). */
export function Callout({ tone = 'purple', icon, className, children, ...props }: CalloutProps) {
  const resolved: Tone = tone === 'danger' ? 'red' : tone;
  return (
    <div
      className={cn('rounded-xl border px-4 py-3', calloutTones[resolved], icon && 'flex items-start gap-3', className)}
      {...props}
    >
      {icon && <span className={cn('mt-0.5 flex shrink-0', textTones[resolved])}>{icon}</span>}
      {icon ? <div className="min-w-0 flex-1">{children}</div> : children}
    </div>
  );
}
