import { describe, expect, it } from 'vitest';
import { clamp, formatRatioStep, parseSpeedEntry, ratioPreset, round2 } from './speedSliderModel';

describe('speedSliderModel', () => {
  it('parses typed values with a comma, an x suffix or a sign', () => {
    expect(parseSpeedEntry('1,15')).toBe(1.15);
    expect(parseSpeedEntry(' 1.25X ')).toBe(1.25);
    expect(parseSpeedEntry('+2')).toBe(2);
    expect(parseSpeedEntry('fast')).toBeNaN();
  });

  it('rounds to hundredths and clamps to the limits', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(clamp(round2(3.04), 0.1, 3)).toBe(3);
  });

  it('labels ratio steps and presets', () => {
    expect(formatRatioStep(-0.1)).toBe('−0.1x');
    expect(formatRatioStep(0.01)).toBe('+0.01x');
    expect(ratioPreset(1)).toEqual({ value: 1, label: '1.0x' });
    expect(ratioPreset(1.25).label).toBe('1.25x');
  });
});
