import { describe, expect, it } from 'vitest';
import { clampSeekToLoop } from './abLoop';

describe('clampSeekToLoop', () => {
  it('leaves seeks untouched without a complete loop', () => {
    expect(clampSeekToLoop(1_000, null, null)).toBe(1_000);
    expect(clampSeekToLoop(1_000, 5_000, null)).toBe(1_000);
    expect(clampSeekToLoop(9_000, null, 8_000)).toBe(9_000);
  });

  it('ignores an inverted or empty loop', () => {
    expect(clampSeekToLoop(1_000, 8_000, 5_000)).toBe(1_000);
    expect(clampSeekToLoop(1_000, 5_000, 5_000)).toBe(1_000);
  });

  it('keeps seeks inside [A, B)', () => {
    expect(clampSeekToLoop(5_000, 5_000, 8_000)).toBe(5_000);
    expect(clampSeekToLoop(6_500, 5_000, 8_000)).toBe(6_500);
    expect(clampSeekToLoop(7_999, 5_000, 8_000)).toBe(7_999);
  });

  it('snaps seeks before A to A', () => {
    expect(clampSeekToLoop(0, 5_000, 8_000)).toBe(5_000);
    expect(clampSeekToLoop(4_999, 5_000, 8_000)).toBe(5_000);
  });

  it('snaps seeks at or past B to A', () => {
    expect(clampSeekToLoop(8_000, 5_000, 8_000)).toBe(5_000);
    expect(clampSeekToLoop(60_000, 5_000, 8_000)).toBe(5_000);
  });
});
