import type { Translations } from '../i18n';

/** Which built-in preset list an id belongs to. */
export type DspPresetKind = 'eq' | 'peq' | 'dynamics';

/** Id of the built-in flat graphic EQ preset (all bands at 0 dB). */
export const FLAT_EQ_PRESET_ID = 'flat';

/** Sentinel id for hand-adjusted graphic EQ bands: it is not a preset from the backend. */
export const CUSTOM_EQ_PRESET_ID = 'custom';

type PresetText = string | { name?: string; description?: string };

/** The dictionary entry for a preset, or `undefined` when the locale has no key for this id. */
function entryFor(loc: Translations, kind: DspPresetKind, id: string): PresetText | undefined {
  const table: Record<string, PresetText> =
    kind === 'eq' ? loc.dsp.eqPreset : kind === 'peq' ? loc.dsp.peqPreset : loc.dsp.dynamicsPreset;
  return Object.hasOwn(table, id) ? table[id] : undefined;
}

/**
 * Localised preset name for a stable preset id.
 * Falls back to `fallbackName` (the English text from the backend) when the locale has no key,
 * so an unknown id such as an AutoEQ profile never renders blank.
 */
export function presetLabel(loc: Translations, kind: DspPresetKind, id: string, fallbackName: string): string {
  const entry = entryFor(loc, kind, id);
  const text = typeof entry === 'string' ? entry : entry?.name;
  return text || fallbackName;
}

/** Localised preset description, with the same fallback rule as {@link presetLabel}. */
export function presetDescription(
  loc: Translations,
  kind: DspPresetKind,
  id: string,
  fallbackDescription = '',
): string {
  const entry = entryFor(loc, kind, id);
  const text = typeof entry === 'string' ? undefined : entry?.description;
  return text || fallbackDescription;
}
