import type React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { tintedTones, type Tone } from './tones';

/*
 * Hover lift, focus outline, press scale, transitions and the disabled look all come from the
 * button rules in `styles/base.css`. Never add `transition-*`, `cursor-*` or disabled opacity here
 * or at a call site.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg border font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        /** The one main action of a screen or dialog. */
        primary: 'border-transparent bg-accent-gradient text-on-accent shadow-lift shadow-accent-pink/30',
        /** Every other action. */
        secondary: 'border-line bg-white/5 text-fg hover:bg-white/8',
        /** A coloured secondary action; the colour comes from `tone`. */
        tinted: '',
        /** Destructive actions (delete, reset, clear). */
        danger: 'border-accent-red/35 bg-accent-red/15 text-accent-red',
        /** Low-emphasis text action. */
        ghost: 'border-transparent bg-transparent text-fg-muted hover:text-fg',
      },
      size: {
        sm: 'gap-1.5 px-2.5 py-1 text-xs',
        md: 'gap-2 px-3.5 py-2 text-ui',
        lg: 'gap-2 px-5 py-2.5 text-sm',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Colour of a `tinted` button. */
  tone?: Tone;
}

/** Text button (optionally with an icon before or after the label). `type="button"` by default. */
export function Button({ variant, size, tone = 'purple', type = 'button', className, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), variant === 'tinted' && tintedTones[tone], className)}
      {...props}
    />
  );
}

const iconButtonVariants = cva('inline-flex shrink-0 items-center justify-center rounded-lg border', {
  variants: {
    variant: {
      ghost: 'border-transparent bg-transparent text-fg-muted hover:text-fg',
      secondary: 'border-line bg-white/5 text-fg-secondary hover:bg-white/8 hover:text-fg',
    },
    size: {
      sm: 'size-7',
      md: 'size-9',
    },
  },
  defaultVariants: { variant: 'ghost', size: 'md' },
});

export interface IconButtonProps
  extends Omit<React.ComponentProps<'button'>, 'aria-label'>,
    VariantProps<typeof iconButtonVariants> {
  /** Accessible name, also shown as the hover tooltip. Required: the button has no text. */
  label: string;
}

/** Icon-only button (close, more, nudge). The icon is the child. */
export function IconButton({ label, variant, size, type = 'button', title, className, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
