/** Anime ambience effects (falling petals, rain, …), in the order the header button cycles through them. */
export const AMBIENCE_MODES = [
  'off',
  'sakura',
  'neon_rain',
  'fireflies',
  'snow',
  'meteor_shower',
  'matrix_rain',
  'momiji',
  'embers',
] as const;

export type AmbienceMode = (typeof AMBIENCE_MODES)[number];
