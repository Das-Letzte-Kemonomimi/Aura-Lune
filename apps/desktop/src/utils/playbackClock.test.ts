import { describe, it, expect } from 'vitest';
import { easeDisplayPosition, extrapolatePositionMs, SNAP_THRESHOLD_MS } from './playbackClock';

const anchor = { positionMs: 10_000, at: 1_000 };
const playing = { speed: 1, playing: true };

describe('extrapolatePositionMs', () => {
  it('advances with wall-clock time at the playback speed', () => {
    expect(extrapolatePositionMs(anchor, 1_100, playing)).toBeCloseTo(10_100, 6);
    expect(extrapolatePositionMs(anchor, 1_100, { speed: 1.5, playing: true })).toBeCloseTo(10_150, 6);
    expect(extrapolatePositionMs(anchor, 1_100, { speed: 0.5, playing: true })).toBeCloseTo(10_050, 6);
  });

  it('returns the last known position when not playing', () => {
    expect(extrapolatePositionMs(anchor, 5_000, { speed: 1, playing: false })).toBe(10_000);
  });

  it('stops extrapolating after maxAheadMs without a new tick (stalled statuses)', () => {
    expect(extrapolatePositionMs(anchor, 60_000, playing)).toBeCloseTo(10_400, 6);
    expect(extrapolatePositionMs(anchor, 60_000, { ...playing, maxAheadMs: 150 })).toBeCloseTo(10_150, 6);
  });

  it('never goes backwards for a time earlier than the anchor, and ignores a bad speed', () => {
    expect(extrapolatePositionMs(anchor, 500, playing)).toBe(10_000);
    expect(extrapolatePositionMs(anchor, 1_100, { speed: NaN, playing: true })).toBeCloseTo(10_100, 6);
    expect(extrapolatePositionMs(anchor, 1_100, { speed: 0, playing: true })).toBeCloseTo(10_100, 6);
  });

  it('clamps to the track duration and to loop B', () => {
    const near = { positionMs: 99_950, at: 0 };
    expect(extrapolatePositionMs(near, 300, { ...playing, durationMs: 100_000 })).toBe(100_000);
    const loopNear = { positionMs: 19_950, at: 0 };
    expect(extrapolatePositionMs(loopNear, 300, { ...playing, loopB: 20_000 })).toBe(20_000);
  });

  it('does not clamp to loop B when playback is already past it', () => {
    const past = { positionMs: 25_000, at: 0 };
    expect(extrapolatePositionMs(past, 100, { ...playing, loopB: 20_000 })).toBeCloseTo(25_100, 6);
  });
});

describe('easeDisplayPosition', () => {
  it('starts at the target and snaps on large jumps (seek / loop wrap)', () => {
    expect(easeDisplayPosition(null, 5_000, 0.016, true)).toBe(5_000);
    expect(easeDisplayPosition(5_000, 5_000 + SNAP_THRESHOLD_MS + 1, 0.016, true)).toBe(5_000 + SNAP_THRESHOLD_MS + 1);
    expect(easeDisplayPosition(20_000, 10_000, 0.016, true)).toBe(10_000); // zapętlenie A-B: skok do tyłu
  });

  it('eases small forward differences toward the target', () => {
    const next = easeDisplayPosition(5_000, 5_100, 0.016, true);
    expect(next).toBeGreaterThan(5_000);
    expect(next).toBeLessThan(5_100);
  });

  it('never moves backwards while playing for a small overshoot, but does when paused', () => {
    expect(easeDisplayPosition(5_100, 5_050, 0.016, true)).toBe(5_100);
    const paused = easeDisplayPosition(5_100, 5_050, 0.016, false);
    expect(paused).toBeLessThan(5_100);
  });
});
