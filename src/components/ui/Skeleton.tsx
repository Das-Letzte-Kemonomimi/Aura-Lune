import type React from 'react';
import { cn } from '../../utils/cn';
import type { ToneOrNeutral } from './tones';

const shapeClasses = {
  rect: 'rounded-xl',
  pill: 'rounded-full',
  circle: 'rounded-full aspect-square',
} as const;

const toneBorders: Record<ToneOrNeutral, string> = {
  neutral: 'border border-white/6',
  pink: 'border border-accent-pink/25 bg-accent-pink/10',
  purple: 'border border-accent-purple/25 bg-accent-purple/10',
  cyan: 'border border-accent-cyan/25 bg-accent-cyan/10',
  green: 'border border-accent-green/25 bg-accent-green/10',
  amber: 'border border-accent-amber/25 bg-accent-amber/10',
  red: 'border border-accent-red/25 bg-accent-red/10',
};

export interface SkeletonProps extends React.ComponentProps<'div'> {
  shape?: keyof typeof shapeClasses;
  tone?: ToneOrNeutral;
}

/**
 * Shimmering placeholder block used in view and panel loading skeletons.
 * Decorative by default (`aria-hidden="true"`).
 */
export function Skeleton({
  shape = 'rect',
  tone = 'neutral',
  className,
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton-shimmer', shapeClasses[shape], toneBorders[tone], className)}
      {...props}
    />
  );
}

export interface SkeletonLoadingPillProps {
  label: string;
  className?: string;
}

/**
 * Compact status pill with animated mini equalizer bars shown in the header of a
 * view skeleton while the chunk or data renders in the background.
 */
export function SkeletonLoadingPill({ label, className }: SkeletonLoadingPillProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-line-accent/45 bg-black/35 px-3 py-1 text-xs font-semibold text-fg-secondary shadow-halo-sm shadow-accent-purple/20',
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex h-3 items-end gap-0.5">
        <span className="h-full w-0.5 origin-bottom rounded-xs bg-accent-pink motion-safe:animate-eq-bar [animation-duration:0.8s]" />
        <span className="h-3/5 w-0.5 origin-bottom rounded-xs bg-accent-purple motion-safe:animate-eq-bar [animation-duration:0.6s] [animation-delay:0.2s]" />
        <span className="h-4/5 w-0.5 origin-bottom rounded-xs bg-accent-cyan motion-safe:animate-eq-bar [animation-duration:0.7s] [animation-delay:0.35s]" />
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}
