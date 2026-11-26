import type React from 'react';
import { cn } from '../../utils/cn';
import { calloutTones, type Tone } from './tones';

export interface CalloutProps extends React.ComponentProps<'div'> {
  tone?: Tone;
}

/** Tinted info/status box ("timer active", "end of track", warnings). */
export function Callout({ tone = 'purple', className, ...props }: CalloutProps) {
  return <div className={cn('rounded-xl border px-4 py-3', calloutTones[tone], className)} {...props} />;
}
