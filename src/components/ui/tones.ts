/**
 * Accent tones shared by the tinted primitives. Every class is written out in full: Tailwind
 * only generates classes it can find as literal strings, so `bg-accent-${tone}` would not work.
 */
export type Tone = 'pink' | 'purple' | 'cyan' | 'green' | 'amber' | 'red';

/** Tinted info box. */
export const calloutTones: Record<Tone, string> = {
  pink: 'border-accent-pink/35 bg-accent-pink/15',
  purple: 'border-accent-purple/35 bg-accent-purple/15',
  cyan: 'border-accent-cyan/35 bg-accent-cyan/15',
  green: 'border-accent-green/35 bg-accent-green/15',
  amber: 'border-accent-amber/35 bg-accent-amber/15',
  red: 'border-accent-red/35 bg-accent-red/15',
};
