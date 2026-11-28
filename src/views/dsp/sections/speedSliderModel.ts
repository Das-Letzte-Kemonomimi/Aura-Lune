/** Pure helpers for `SpeedSliderCard` and the three speed cards that use it. */

/** Nudge steps shared by the three speed cards, in visual order: fine (±0.01) outside, coarse (±0.1) inside. */
export const SPEED_NUDGES = [-0.01, -0.1, 0.1, 0.01] as const;

/** Nudge label for a ratio step: `−0.1x`, `+0.01x`. */
export const formatRatioStep = (step: number) => `${step < 0 ? '−' : '+'}${Math.abs(step)}x`;

/** Preset chip for a ratio: `0.8x`, `1.0x`. */
export const ratioPreset = (value: number) => ({ value, label: value === 1 ? '1.0x' : `${value}x` });

export const round2 = (v: number) => Math.round(v * 100) / 100;

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Reads a typed value; accepts `1,15`, `1.15x` and `+2`. NaN when it is not a number. */
export const parseSpeedEntry = (text: string) => parseFloat(text.replace(/x/gi, '').replace(',', '.').trim());
