import { describe, expect, it } from 'vitest';
import { totalPitchShiftSemitones, transposeKeyIndex } from './keyTranspose';

describe('totalPitchShiftSemitones', () => {
  it('is the identity at rate 1 and no pitch', () => {
    expect(totalPitchShiftSemitones(0, 1)).toBe(0);
  });

  it('shifts +12 semitones at rate 2 and -12 at rate 0.5', () => {
    expect(totalPitchShiftSemitones(0, 2)).toBeCloseTo(12);
    expect(totalPitchShiftSemitones(0, 0.5)).toBeCloseTo(-12);
  });

  it('adds explicit pitch to the rate shift', () => {
    expect(totalPitchShiftSemitones(2, 2)).toBeCloseTo(14);
  });

  it('shifts roughly -2.4 / +2.1 semitones for rates 0.87 / 1.13', () => {
    expect(totalPitchShiftSemitones(0, 0.87)).toBeCloseTo(-2.41, 1);
    expect(totalPitchShiftSemitones(0, 1.13)).toBeCloseTo(2.12, 1);
  });

  it('falls back to neutral values for invalid input', () => {
    expect(totalPitchShiftSemitones(Number.NaN, 0)).toBe(0);
  });
});

describe('transposeKeyIndex', () => {
  it('wraps around the octave in both directions', () => {
    expect(transposeKeyIndex(10, 3)).toBe(1);
    expect(transposeKeyIndex(1, -3)).toBe(10);
  });

  it('keeps the same key for whole octaves', () => {
    for (let base = 0; base < 12; base++) {
      expect(transposeKeyIndex(base, 12)).toBe(base);
      expect(transposeKeyIndex(base, -24)).toBe(base);
    }
  });

  it('rounds to the nearest key', () => {
    expect(transposeKeyIndex(0, 2.4)).toBe(2);
    expect(transposeKeyIndex(0, -2.41)).toBe(10);
  });

  it('rate 0.87 moves C down two semitones (A#)', () => {
    expect(transposeKeyIndex(0, totalPitchShiftSemitones(0, 0.87))).toBe(10);
  });
});
