import type React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { pressedTones, type Tone } from './tones';

const chipVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white/5 font-semibold whitespace-nowrap text-fg-secondary hover:text-fg',
  {
    variants: {
      size: {
        xs: 'px-2 py-0.5 text-xxs',
        sm: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { size: 'sm' },
  },
);

export interface ChipProps
  extends Omit<React.ComponentProps<'button'>, 'aria-pressed'>,
    VariantProps<typeof chipVariants> {
  /** Toggled on. Rendered as `aria-pressed`, which also drives the pressed look. */
  pressed: boolean;
  tone?: Tone;
}

/** Toggle chip (presets, filters, on/off options). */
export function Chip({ pressed, tone = 'pink', size, type = 'button', className, ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(chipVariants({ size }), pressedTones[tone], className)}
      {...props}
    />
  );
}

export interface OptionCardProps extends Omit<React.ComponentProps<'button'>, 'aria-pressed'> {
  /** The selected option. Rendered as `aria-pressed`, which also drives the selected look. */
  pressed: boolean;
  tone?: Tone;
}

/**
 * A large selectable option with a title and description (UI scale, icon style). It is the
 * card-sized sibling of `Chip`: the same pressed tint, laid out as a column.
 */
export function OptionCard({ pressed, tone = 'pink', type = 'button', className, ...props }: OptionCardProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        'flex flex-col items-start gap-1 rounded-xl border border-line bg-card p-4 text-left text-fg hover:border-line-accent',
        pressedTones[tone],
        className,
      )}
      {...props}
    />
  );
}
