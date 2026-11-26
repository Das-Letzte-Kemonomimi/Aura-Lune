import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROMAJI_MODE,
  defaultOverlayPosition,
  nextRomajiMode,
  parseOverlayPosition,
  parseRomajiMode,
  ROMAJI_MODES,
} from './lyricsModel';

describe('parseRomajiMode', () => {
  it('accepts every known mode', () => {
    for (const mode of ROMAJI_MODES) expect(parseRomajiMode(mode)).toBe(mode);
  });

  it('rejects unknown and empty values', () => {
    expect(parseRomajiMode('kana')).toBeUndefined();
    expect(parseRomajiMode('')).toBeUndefined();
    expect(parseRomajiMode('DUAL')).toBeUndefined();
  });
});

describe('nextRomajiMode', () => {
  it('cycles original → dual → romaji → original', () => {
    expect(nextRomajiMode('original')).toBe('dual');
    expect(nextRomajiMode('dual')).toBe('romaji');
    expect(nextRomajiMode('romaji')).toBe('original');
  });

  it('visits every mode once before wrapping', () => {
    const seen = new Set<string>();
    let mode = DEFAULT_ROMAJI_MODE;
    for (let i = 0; i < ROMAJI_MODES.length; i++) {
      seen.add(mode);
      mode = nextRomajiMode(mode);
    }
    expect(seen.size).toBe(ROMAJI_MODES.length);
    expect(mode).toBe(DEFAULT_ROMAJI_MODE);
  });
});

describe('parseOverlayPosition', () => {
  it('reads a saved position', () => {
    expect(parseOverlayPosition('{"x":120,"y":340}')).toEqual({ x: 120, y: 340 });
  });

  it('rejects corrupt or incomplete values', () => {
    expect(parseOverlayPosition('{not json')).toBeUndefined();
    expect(parseOverlayPosition('null')).toBeUndefined();
    expect(parseOverlayPosition('42')).toBeUndefined();
    expect(parseOverlayPosition('{"x":1}')).toBeUndefined();
    expect(parseOverlayPosition('{"x":"1","y":2}')).toBeUndefined();
    expect(parseOverlayPosition('{"x":null,"y":2}')).toBeUndefined();
  });
});

describe('defaultOverlayPosition', () => {
  it('centres the widget at the bottom of a large window', () => {
    expect(defaultOverlayPosition(1280, 800)).toEqual({ x: 320, y: 600 });
  });

  it('keeps the widget on screen in a small window', () => {
    expect(defaultOverlayPosition(400, 150)).toEqual({ x: 20, y: 40 });
  });
});
