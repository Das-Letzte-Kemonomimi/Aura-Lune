import { describe, it, expect } from 'vitest';
import { DB_PER_PERCENT, sliderToVolume, stepVolume, volumeToDb, volumeToSlider } from './volumeScale';

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
