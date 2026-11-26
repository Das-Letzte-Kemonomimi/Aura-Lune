import type React from 'react';
import { cn } from '../../utils/cn';
import { badgeTones, type Tone } from './tones';

export interface BadgeProps extends React.ComponentProps<'span'> {
  tone?: Tone;
}

/** Small uppercase status label (FLAC, HI-RES, NEW…). */
export function Badge({ tone = 'purple', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-sm px-2 py-0.5 text-xxs font-bold tracking-wider uppercase', badgeTones[tone], className)}
      {...props}
    />
  );
}
