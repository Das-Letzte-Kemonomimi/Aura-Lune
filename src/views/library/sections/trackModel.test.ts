import { describe, expect, it } from 'vitest';
import { isHiRes } from './trackModel';

describe('isHiRes', () => {
  it('accepts 24-bit files at CD sample rate', () => {
    expect(isHiRes({ bit_depth: 24, sample_rate: 44100 })).toBe(true);
  });

  it('accepts 88.2 kHz and up without a bit depth', () => {
    expect(isHiRes({ bit_depth: null, sample_rate: 88200 })).toBe(true);
  });

  it('rejects 16-bit 48 kHz and lossy files without a bit depth', () => {
    expect(isHiRes({ bit_depth: 16, sample_rate: 48000 })).toBe(false);
    expect(isHiRes({ bit_depth: null, sample_rate: 44100 })).toBe(false);
  });
});
