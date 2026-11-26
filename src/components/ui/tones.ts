/**
 * Accent tones shared by the tinted primitives. Every class is written out in full: Tailwind
 * only generates classes it can find as literal strings, so `bg-accent-${tone}` would not work.
 */
export type Tone = 'pink' | 'purple' | 'cyan' | 'green' | 'amber' | 'red';

/** Square icon tile in modal headers. */
export const iconTileTones: Record<Tone, string> = {
  pink: 'border-accent-pink bg-accent-pink/20 text-accent-pink',
  purple: 'border-accent-purple bg-accent-purple/20 text-accent-purple',
  cyan: 'border-accent-cyan bg-accent-cyan/20 text-accent-cyan',
  green: 'border-accent-green bg-accent-green/20 text-accent-green',
  amber: 'border-accent-amber bg-accent-amber/20 text-accent-amber',
  red: 'border-accent-red bg-accent-red/20 text-accent-red',
};

/** Tinted info box. */
export const calloutTones: Record<Tone, string> = {
  pink: 'border-accent-pink/35 bg-accent-pink/15',
  purple: 'border-accent-purple/35 bg-accent-purple/15',
  cyan: 'border-accent-cyan/35 bg-accent-cyan/15',
  green: 'border-accent-green/35 bg-accent-green/15',
  amber: 'border-accent-amber/35 bg-accent-amber/15',
  red: 'border-accent-red/35 bg-accent-red/15',
};

/** Small uppercase status badge. */
export const badgeTones: Record<Tone, string> = {
  pink: 'bg-accent-pink/15 text-accent-pink',
  purple: 'bg-accent-purple/15 text-accent-purple',
  cyan: 'bg-accent-cyan/15 text-accent-cyan',
  green: 'bg-accent-green/15 text-accent-green',
  amber: 'bg-accent-amber/15 text-accent-amber',
  red: 'bg-accent-red/15 text-accent-red',
};
