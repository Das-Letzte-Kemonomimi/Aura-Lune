import { describe, expect, it } from 'vitest';
import {
  calculateBeatMatchedCrossfadeMs,
  calculateBpmMatchScore,
  evaluateHarmonicMatch,
} from './harmonicMixing';

describe('calculateBpmMatchScore', () => {
  it('gives a perfect score for identical tempo', () => {
    expect(calculateBpmMatchScore(128, 128)).toEqual({ score: 100, diffPercent: 0, relation: 'direct' });
  });

  it('recognises half-time and double-time relations', () => {
    expect(calculateBpmMatchScore(140, 70)).toMatchObject({ score: 100, relation: 'half' });
    expect(calculateBpmMatchScore(70, 140)).toMatchObject({ score: 100, relation: 'double' });
  });

  it('falls off with the tempo difference', () => {
    const near = calculateBpmMatchScore(128, 130); // ~1.6%
    const pitchFaderLimit = calculateBpmMatchScore(100, 106); // 6%
    const far = calculateBpmMatchScore(100, 125); // 25%
    expect(near.score).toBeGreaterThan(pitchFaderLimit.score);
    expect(pitchFaderLimit.score).toBe(65);
    expect(pitchFaderLimit.diffPercent).toBe(6);
    expect(far.score).toBeLessThan(15);
    expect(far.score).toBeGreaterThanOrEqual(0);
  });

  it('returns a neutral score when a tempo is unknown', () => {
    expect(calculateBpmMatchScore(0, 128).score).toBe(50);
    expect(calculateBpmMatchScore(128, -1).score).toBe(50);
  });
});

describe('calculateBeatMatchedCrossfadeMs', () => {
  it('lasts the requested number of beats', () => {
    expect(calculateBeatMatchedCrossfadeMs(128)).toBe(3750); // 8 beats
    expect(calculateBeatMatchedCrossfadeMs(120, 4)).toBe(2000);
  });

  it('clamps to the 1–8 s range', () => {
    expect(calculateBeatMatchedCrossfadeMs(250, 2)).toBe(1000);
    expect(calculateBeatMatchedCrossfadeMs(60, 16)).toBe(8000);
  });

  it('uses 3 s for implausible tempos', () => {
    expect(calculateBeatMatchedCrossfadeMs(30)).toBe(3000);
    expect(calculateBeatMatchedCrossfadeMs(300)).toBe(3000);
  });
});

describe('evaluateHarmonicMatch', () => {
  it('rates the same key and tempo as a perfect match', () => {
    const r = evaluateHarmonicMatch('8A', 124, '8A', 124);
    expect(r.matchType).toBe('perfect');
    expect(r.score).toBe(100);
    expect(r.bpmRelation).toBe('direct');
    expect(r.suggestedCrossfadeMs).toBe(calculateBeatMatchedCrossfadeMs(124));
  });

  it('weights key 60% and tempo 40%', () => {
    const r = evaluateHarmonicMatch('8A', 100, '8A', 125);
    expect(r.score).toBe(Math.round(r.keyScore * 0.6 + r.bpmScore * 0.4));
    expect(r.score).toBeLessThan(100);
  });

  it('marks a same-key half-time pairing', () => {
    const r = evaluateHarmonicMatch('5B', 140, '5B', 70);
    expect(r.matchType).toBe('half_double');
    expect(r.bpmRelation).toBe('half');
    expect(r.badgeLabel).toContain('Half-Time');
  });

  it('falls back to a neutral key score and 128 BPM when data is missing', () => {
    const r = evaluateHarmonicMatch(null, null, undefined, 0);
    expect(r.matchType).toBe('compatible');
    expect(r.keyScore).toBe(50);
    expect(r.bpmScore).toBe(100);
    expect(r.suggestedCrossfadeMs).toBe(calculateBeatMatchedCrossfadeMs(128));
  });

  it('flags distant keys as riskier than neighbours', () => {
    const neighbour = evaluateHarmonicMatch('8A', 124, '9A', 124);
    const distant = evaluateHarmonicMatch('8A', 124, '2B', 124);
    expect(neighbour.keyScore).toBeGreaterThan(distant.keyScore);
  });
});
