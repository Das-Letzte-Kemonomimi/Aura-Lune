/**
 * Lyrics display preferences shared by the player lyrics panel (`LyricsView`) and the floating
 * desktop widget (`DesktopLyricsOverlay`). Both persist the romaji mode under the same key, so the key,
 * the parser, the default and the cycle order live here and cannot drift apart.
 */
import { parseOneOf } from '../../hooks/usePersistedState';

/** How Japanese lyrics are shown. The array order is the order the toggle cycles through. */
export const ROMAJI_MODES = ['original', 'dual', 'romaji'] as const;

export type RomajiMode = (typeof ROMAJI_MODES)[number];

export const ROMAJI_MODE_STORAGE_KEY = 'auralune_lyrics_romaji_mode';

/** Kana and romaji on two lines (karaoke style). */
export const DEFAULT_ROMAJI_MODE: RomajiMode = 'dual';

export const parseRomajiMode = parseOneOf(ROMAJI_MODES);

/** The mode after `mode` in the cycle original → dual → romaji → original. */
export function nextRomajiMode(mode: RomajiMode): RomajiMode {
  return ROMAJI_MODES[(ROMAJI_MODES.indexOf(mode) + 1) % ROMAJI_MODES.length];
}

/** Top-left corner of the floating desktop lyrics widget, in window pixels. */
export interface OverlayPosition {
  x: number;
  y: number;
}

export const OVERLAY_POSITION_STORAGE_KEY = 'auralune_desktop_lyrics_pos';

/** Saved JSON `{ x, y }`; anything else (corrupt text, missing or non-finite coordinates) is invalid. */
export function parseOverlayPosition(raw: string): OverlayPosition | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const { x, y } = parsed as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    return { x, y };
  } catch {
    return undefined;
  }
}

/** Default placement: bottom centre of the window. */
export function defaultOverlayPosition(viewportWidth: number, viewportHeight: number): OverlayPosition {
  return {
    x: Math.max(20, Math.floor((viewportWidth - 640) / 2)),
    y: Math.max(40, viewportHeight - 200),
  };
}
