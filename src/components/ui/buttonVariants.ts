import { cva } from 'class-variance-authority';

/**
 * Shared button styles. The global base layer (`src/styles/base.css`) already adds the hover
 * lift/glow, press scale, focus ring and disabled dimming to every <button>.
 */
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 border font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        /** Brand gradient call to action. */
        primary: 'bg-accent-gradient border-transparent font-bold text-on-accent shadow-brand',
        /** Quiet glass button. */
        secondary: 'border-line bg-white/5 text-fg-secondary hover:text-fg',
        /** Borderless, text-only. */
        ghost: 'border-transparent bg-transparent text-fg-muted hover:text-fg',
        /** Destructive action. */
        danger: 'border-accent-red/40 bg-accent-red/20 text-accent-red',
        /**
         * Toggle pill. Pass `aria-pressed` to switch it on; the pressed style lives on the
         * attribute so screen readers and the visuals can never disagree.
         */
        chip: [
          'border-line bg-white/5 text-fg-secondary',
          'aria-pressed:bg-accent-gradient aria-pressed:border-accent-pink aria-pressed:text-on-accent aria-pressed:shadow-brand-glow',
        ],
      },
      size: {
        sm: 'rounded-md px-3 py-1.5 text-xs',
        md: 'rounded-lg px-5 py-2 text-ui',
        icon: 'rounded-lg p-1',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);
