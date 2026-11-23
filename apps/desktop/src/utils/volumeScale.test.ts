import { describe, it, expect } from 'vitest';
import { DB_PER_PERCENT, normalizeDbStep, sliderToVolume, stepVolume, volumeToDb, volumeToSlider } from './volumeScale';

const dbAt = (percent: number) => volumeToDb(sliderToVolume(percent / 100, 'db'));

describe('volumeScale (dB mode)', () => {
  it('100% is 0.0 dB (digital maximum)', () => {
    expect(sliderToVolume(1, 'db')).toBe(1);
    expect(dbAt(100)).toBeCloseTo(0, 10);
  });

  it('every 5% down lowers the level by 1.5 dB', () => {
    expect(dbAt(95)).toBeCloseTo(-1.5, 6);
    expect(dbAt(90)).toBeCloseTo(-3.0, 6);
    expect(dbAt(85)).toBeCloseTo(-4.5, 6);
    expect(dbAt(50)).toBeCloseTo(-15, 6);
  });

  it('every 1% down lowers the level by 0.3 dB (89% = -3.3 dB)', () => {
    expect(DB_PER_PERCENT).toBe(0.3);
    expect(dbAt(89)).toBeCloseTo(-3.3, 6);
    expect(dbAt(99)).toBeCloseTo(-0.3, 6);
  });

  it('0% is silence', () => {
    expect(sliderToVolume(0, 'db')).toBe(0);
    expect(volumeToDb(0)).toBe(-Infinity);
  });

  it('round-trips every slider percent (also through a float32-ish backend value)', () => {
    for (let p = 0; p <= 100; p++) {
      const vol = sliderToVolume(p / 100, 'db');
      expect(Math.round(volumeToSlider(vol, 'db') * 100)).toBe(p);
      const f32 = Math.fround(vol);
      expect(Math.round(volumeToSlider(f32, 'db') * 100)).toBe(p);
    }
  });

  it('clamps out-of-range input', () => {
    expect(sliderToVolume(1.5, 'db')).toBe(1);
    expect(sliderToVolume(-1, 'db')).toBe(0);
    expect(volumeToSlider(2, 'db')).toBe(1);
    expect(volumeToSlider(NaN, 'db')).toBe(0);
  });

  it('shows very quiet volumes (below -30 dB) at the bottom of the slider', () => {
    expect(volumeToSlider(0.001, 'db')).toBe(0);
  });
});

describe('volumeScale (percent mode)', () => {
  it('is the identity (amplitude is linear in the slider)', () => {
    expect(sliderToVolume(0.37, 'percent')).toBe(0.37);
    expect(volumeToSlider(0.37, 'percent')).toBe(0.37);
  });
});

describe('stepVolume', () => {
  it('moves 5% of slider position per key press in dB mode (1.5 dB)', () => {
    const down = stepVolume(1, -1, 'db');
    expect(volumeToDb(down)).toBeCloseTo(-1.5, 6);
    expect(volumeToDb(stepVolume(down, -1, 'db'))).toBeCloseTo(-3.0, 6);
    expect(stepVolume(down, 1, 'db')).toBe(1);
  });

  it('clamps at 100% and at silence', () => {
    expect(stepVolume(1, 1, 'db')).toBe(1);
    expect(stepVolume(sliderToVolume(0.03, 'db'), -1, 'db')).toBe(0);
  });

  it('keeps the old +/-0.05 behaviour in percent mode', () => {
    expect(stepVolume(0.5, 1, 'percent')).toBeCloseTo(0.55, 10);
    expect(stepVolume(0.5, -1, 'percent')).toBeCloseTo(0.45, 10);
    expect(stepVolume(1, 1, 'percent')).toBe(1);
    expect(stepVolume(0.02, -1, 'percent')).toBe(0);
  });
});

describe('volumeScale (dB mode, 1.2 dB per 5% step)', () => {
  const dbAt12 = (percent: number) => volumeToDb(sliderToVolume(percent / 100, 'db', 1.2));

  it('every 5% down lowers the level by 1.2 dB (0.24 dB per 1%)', () => {
    expect(dbAt12(100)).toBeCloseTo(0, 10);
    expect(dbAt12(95)).toBeCloseTo(-1.2, 6);
    expect(dbAt12(90)).toBeCloseTo(-2.4, 6);
    expect(dbAt12(89)).toBeCloseTo(-2.64, 6);
    expect(dbAt12(0)).toBe(-Infinity);
  });

  it('round-trips every slider percent', () => {
    for (let p = 0; p <= 100; p++) {
      const vol = Math.fround(sliderToVolume(p / 100, 'db', 1.2));
      expect(Math.round(volumeToSlider(vol, 'db', 1.2) * 100)).toBe(p);
    }
  });

  it('the same amplitude sits at a different slider position per step size', () => {
    const vol = sliderToVolume(0.9, 'db', 1.5); // -3.0 dB
    expect(volumeToSlider(vol, 'db', 1.5)).toBe(0.9);
    expect(volumeToSlider(vol, 'db', 1.2)).toBe(0.88); // -3.0 / 0.24 = -12.5% -> rounds to 88%
  });

  it('keys step 5% of the slider = 1.2 dB', () => {
    expect(volumeToDb(stepVolume(1, -1, 'db', 1.2))).toBeCloseTo(-1.2, 6);
  });

  it('ignores the step in percent mode', () => {
    expect(sliderToVolume(0.37, 'percent', 1.2)).toBe(0.37);
    expect(stepVolume(0.5, 1, 'percent', 1.2)).toBeCloseTo(0.55, 10);
  });
});

describe('normalizeDbStep', () => {
  it('accepts only the supported steps and defaults to 1.5', () => {
    expect(normalizeDbStep(1.2)).toBe(1.2);
    expect(normalizeDbStep('1.2')).toBe(1.2);
    expect(normalizeDbStep('1.5')).toBe(1.5);
    expect(normalizeDbStep('2')).toBe(1.5);
    expect(normalizeDbStep(null)).toBe(1.5);
    expect(normalizeDbStep(undefined)).toBe(1.5);
  });
});
