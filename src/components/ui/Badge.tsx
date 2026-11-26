import type React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { badgeTones, type ToneOrNeutral } from './tones';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-md font-semibold whitespace-nowrap', {
  variants: {
    size: {
      xs: 'px-1.5 py-0.5 text-2xs',
      sm: 'px-2 py-0.5 text-xxs',
    },
    /** Monospace digits for readouts (dB, Hz, BPM). */
    mono: { true: 'font-mono tabular-nums', false: '' },
  },
  defaultVariants: { size: 'sm', mono: false },
});

export interface BadgeProps extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  tone?: ToneOrNeutral;
}

/** Small read-only pill: a status, a format, a value readout. */
export function Badge({ tone = 'neutral', size, mono, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ size, mono }), badgeTones[tone], className)} {...props} />;
}
