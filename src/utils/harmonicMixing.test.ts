// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  parseCamelotKey,
  getCamelotDistance,
  calculateKeyHarmonicScore,
  getTransposedKey,
} from './harmonicMixing';

describe('harmonicMixing - Camelot Wheel calculations', () => {
  it('parses valid Camelot raw codes correctly', () => {
    const k8a = parseCamelotKey('8A');
    expect(k8a).not.toBeNull();
    expect(k8a?.number).toBe(8);
    expect(k8a?.letter).toBe('A');
    expect(k8a?.keyName).toBe('A min');

    const k11b = parseCamelotKey('11B');
    expect(k11b).not.toBeNull();
    expect(k11b?.number).toBe(11);
    expect(k11b?.letter).toBe('B');
    expect(k11b?.keyName).toBe('A Maj');
  });

  it('parses standard musical key notation into Camelot representation', () => {
    const am = parseCamelotKey('Am');
    expect(am?.raw).toBe('8A');

    const cmaj = parseCamelotKey('C Maj');
    expect(cmaj?.raw).toBe('8B');

    const fsharpMin = parseCamelotKey('F#m');
    expect(fsharpMin?.raw).toBe('11A');
  });

  it('calculates the shortest distance along the 12-hour Camelot wheel', () => {
    expect(getCamelotDistance(8, 8)).toBe(0);
    expect(getCamelotDistance(8, 9)).toBe(1);
    expect(getCamelotDistance(12, 1)).toBe(1); // wrap-around
    expect(getCamelotDistance(1, 12)).toBe(1); // wrap-around
    expect(getCamelotDistance(1, 7)).toBe(6);  // opposite side
  });

  it('scores harmonic transitions accurately', () => {
    const key8A = parseCamelotKey('8A')!;
    const key8B = parseCamelotKey('8B')!;
    const key9A = parseCamelotKey('9A')!;
    const key2A = parseCamelotKey('2A')!;

    // Perfect match
    const perfect = calculateKeyHarmonicScore(key8A, key8A);
    expect(perfect.score).toBe(100);
    expect(perfect.type).toBe('perfect');

    // Relative Major/Minor
    const relative = calculateKeyHarmonicScore(key8A, key8B);
    expect(relative.score).toBe(95);
    expect(relative.type).toBe('relative');

    // Energy Step (+1)
    const adjacent = calculateKeyHarmonicScore(key8A, key9A);
    expect(adjacent.score).toBe(90);
    expect(adjacent.type).toBe('adjacent');

    // Distant/Dissonant
    const dissonant = calculateKeyHarmonicScore(key8A, key2A);
    expect(dissonant.score).toBeLessThan(50);
    expect(dissonant.type).toBe('dissonant');
  });

  it('calculates pitch transposition on keys', () => {
    // 8A is A minor. Transpose +2 semitones -> B minor (10A)
    const transposed = getTransposedKey('8A', 2);
    expect(transposed).not.toBeNull();
    expect(transposed?.camelot).toBe('10A');
    expect(transposed?.keyName).toBe('B min');
  });
});
