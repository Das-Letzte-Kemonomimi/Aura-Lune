// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { playbackSpeed } from './playbackSpeed';

describe('playbackSpeed', () => {
  it('is 1 in Bypass regardless of tempo/rate', () => {
    expect(playbackSpeed({ engine: 'Bypass', tempo: 1.5, rate: 2 })).toBe(1);
    expect(playbackSpeed({ tempo: 1.5 })).toBe(1);
  });

  it('is tempo * rate when a DSP engine is active', () => {
    expect(playbackSpeed({ engine: 'RubberBand', tempo: 1.25, rate: 0.8 })).toBeCloseTo(1.0, 6);
    expect(playbackSpeed({ engine: 'SoundTouch', tempo: 1.5, rate: 1 })).toBeCloseTo(1.5, 6);
  });

  it('honours an explicit isDspActive over the engine name', () => {
    expect(playbackSpeed({ engine: 'RubberBand', tempo: 2, isDspActive: false })).toBe(1);
    expect(playbackSpeed({ engine: 'Bypass', tempo: 2, isDspActive: true })).toBe(2);
  });

  it('clamps to 0.1..4 and treats zero tempo/rate as 1', () => {
    expect(playbackSpeed({ engine: 'RubberBand', tempo: 10 })).toBe(4);
    expect(playbackSpeed({ engine: 'RubberBand', tempo: 0.01 })).toBe(0.1);
    expect(playbackSpeed({ engine: 'RubberBand', tempo: 0, rate: 0 })).toBe(1);
  });
});
