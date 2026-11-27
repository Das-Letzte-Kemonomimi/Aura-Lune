import { describe, it, expect } from 'vitest';
import { setCssColorOpacity } from './colorOpacity';

describe('setCssColorOpacity', () => {
  it('replaces alpha on rgba() strings', () => {
    expect(setCssColorOpacity('rgba(18, 20, 36, 0.8)', 1)).toBe('rgba(18, 20, 36, 1)');
    expect(setCssColorOpacity('rgba(25, 28, 48, 0.6)', 0.7)).toBe('rgba(25, 28, 48, 0.7)');
  });

  it('sets alpha on rgb() strings', () => {
    expect(setCssColorOpacity('rgb(18, 20, 36)', 0.5)).toBe('rgba(18, 20, 36, 0.5)');
  });

  it('clamps opacity to [0, 1]', () => {
    expect(setCssColorOpacity('rgba(18, 20, 36, 0.8)', 1.5)).toBe('rgba(18, 20, 36, 1)');
    expect(setCssColorOpacity('rgba(18, 20, 36, 0.8)', -0.2)).toBe('rgba(18, 20, 36, 0)');
  });

  it('falls back to color-mix for hex or named colours', () => {
    expect(setCssColorOpacity('#121424', 0.65)).toBe('color-mix(in srgb, #121424 65%, transparent)');
  });
});
