import { describe, expect, it } from 'vitest';
import { clampCrossfadeMs, parseCrossfadeSetting } from './crossfade';

describe('crossfade helpers', () => {
  it('clamps and rounds to the engine range', () => {
    expect(clampCrossfadeMs(-5)).toBe(0);
    expect(clampCrossfadeMs(9000)).toBe(8000);
    expect(clampCrossfadeMs(1250.6)).toBe(1251);
  });

  it('parses persisted values, falling back to the default when malformed', () => {
    expect(parseCrossfadeSetting('3000')).toBe(3000);
    expect(parseCrossfadeSetting('0')).toBe(0);
    expect(parseCrossfadeSetting('99999')).toBe(8000);
    expect(parseCrossfadeSetting(null)).toBe(1500);
    expect(parseCrossfadeSetting('')).toBe(1500);
    expect(parseCrossfadeSetting('abc')).toBe(1500);
  });
});
