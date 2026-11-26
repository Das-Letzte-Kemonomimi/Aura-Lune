/**
 * Accent tones shared by the tinted primitives. Every class is written out in full: Tailwind
 * only generates classes it can find as literal strings, so `bg-accent-${tone}` would not work.
 *
 * The tint rules (see the `tailwind-v4` skill):
 *   info box / tinted button  `bg-X/15 border-X/35 text-accent-X`
 *   pressed chip / tab        `bg-X/20 border-X text-accent-X`
 *   badge                     `bg-X/20 text-accent-X`
 *   highlighted card          `border-X/45 bg-X/5`
 */
export type Tone = 'pink' | 'purple' | 'cyan' | 'green' | 'amber' | 'red';

/** A tone, or the untinted grey used by neutral badges and dots. */
export type ToneOrNeutral = Tone | 'neutral';

/** Tinted info box. */
export const calloutTones: Record<Tone, string> = {
  pink: 'border-accent-pink/35 bg-accent-pink/15',
  purple: 'border-accent-purple/35 bg-accent-purple/15',
  cyan: 'border-accent-cyan/35 bg-accent-cyan/15',
  green: 'border-accent-green/35 bg-accent-green/15',
  amber: 'border-accent-amber/35 bg-accent-amber/15',
  red: 'border-accent-red/35 bg-accent-red/15',
};

/** Tinted button: the info-box tint plus the accent text colour. */
export const tintedTones: Record<Tone, string> = {
  pink: 'border-accent-pink/35 bg-accent-pink/15 text-accent-pink',
  purple: 'border-accent-purple/35 bg-accent-purple/15 text-accent-purple',
  cyan: 'border-accent-cyan/35 bg-accent-cyan/15 text-accent-cyan',
  green: 'border-accent-green/35 bg-accent-green/15 text-accent-green',
  amber: 'border-accent-amber/35 bg-accent-amber/15 text-accent-amber',
  red: 'border-accent-red/35 bg-accent-red/15 text-accent-red',
};

/** Pressed chip, keyed off `aria-pressed` so the look always matches what screen readers hear. */
export const pressedTones: Record<Tone, string> = {
  pink: 'aria-pressed:border-accent-pink aria-pressed:bg-accent-pink/20 aria-pressed:text-accent-pink',
  purple: 'aria-pressed:border-accent-purple aria-pressed:bg-accent-purple/20 aria-pressed:text-accent-purple',
  cyan: 'aria-pressed:border-accent-cyan aria-pressed:bg-accent-cyan/20 aria-pressed:text-accent-cyan',
  green: 'aria-pressed:border-accent-green aria-pressed:bg-accent-green/20 aria-pressed:text-accent-green',
  amber: 'aria-pressed:border-accent-amber aria-pressed:bg-accent-amber/20 aria-pressed:text-accent-amber',
  red: 'aria-pressed:border-accent-red aria-pressed:bg-accent-red/20 aria-pressed:text-accent-red',
};

/** Selected tab of a segmented control, keyed off `aria-selected`. */
export const selectedTones: Record<Tone, string> = {
  pink: 'aria-selected:bg-accent-pink/20 aria-selected:text-accent-pink',
  purple: 'aria-selected:bg-accent-purple/20 aria-selected:text-accent-purple',
  cyan: 'aria-selected:bg-accent-cyan/20 aria-selected:text-accent-cyan',
  green: 'aria-selected:bg-accent-green/20 aria-selected:text-accent-green',
  amber: 'aria-selected:bg-accent-amber/20 aria-selected:text-accent-amber',
  red: 'aria-selected:bg-accent-red/20 aria-selected:text-accent-red',
};

/** Badge / pill. */
export const badgeTones: Record<ToneOrNeutral, string> = {
  pink: 'bg-accent-pink/20 text-accent-pink',
  purple: 'bg-accent-purple/20 text-accent-purple',
  cyan: 'bg-accent-cyan/20 text-accent-cyan',
  green: 'bg-accent-green/20 text-accent-green',
  amber: 'bg-accent-amber/20 text-accent-amber',
  red: 'bg-accent-red/20 text-accent-red',
  neutral: 'bg-white/8 text-fg-secondary',
};

/** Card whose feature is switched on: a soft outline and wash, quieter than an info box. */
export const highlightTones: Record<Tone, string> = {
  pink: 'border-accent-pink/45 bg-accent-pink/5',
  purple: 'border-accent-purple/45 bg-accent-purple/5',
  cyan: 'border-accent-cyan/45 bg-accent-cyan/5',
  green: 'border-accent-green/45 bg-accent-green/5',
  amber: 'border-accent-amber/45 bg-accent-amber/5',
  red: 'border-accent-red/45 bg-accent-red/5',
};

/** Icon tile next to a heading: the badge tint at the info-box strength. */
export const iconTileTones: Record<Tone, string> = {
  pink: 'bg-accent-pink/15 text-accent-pink',
  purple: 'bg-accent-purple/15 text-accent-purple',
  cyan: 'bg-accent-cyan/15 text-accent-cyan',
  green: 'bg-accent-green/15 text-accent-green',
  amber: 'bg-accent-amber/15 text-accent-amber',
  red: 'bg-accent-red/15 text-accent-red',
};

/** Plain accent text (icons, spinners, values). */
export const textTones: Record<ToneOrNeutral, string> = {
  pink: 'text-accent-pink',
  purple: 'text-accent-purple',
  cyan: 'text-accent-cyan',
  green: 'text-accent-green',
  amber: 'text-accent-amber',
  red: 'text-accent-red',
  neutral: 'text-fg-muted',
};

/** Solid fill (status dots, single-colour progress bars). */
export const solidTones: Record<ToneOrNeutral, string> = {
  pink: 'bg-accent-pink',
  purple: 'bg-accent-purple',
  cyan: 'bg-accent-cyan',
  green: 'bg-accent-green',
  amber: 'bg-accent-amber',
  red: 'bg-accent-red',
  neutral: 'bg-fg-muted',
};
