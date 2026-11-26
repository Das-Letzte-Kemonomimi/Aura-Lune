import { describe, it, expect } from 'vitest';
import {
  normalizeFilterType,
  calculateBiquadResponseDb,
  freqToNormX,
  normXToFreq,
  generateFrequencyResponseCurve,
  gainToNormY,
  normYToGain,
} from './parametricEqMath';

describe('parametricEqMath - Biquad audio DSP math & frequency curve', () => {
  it('normalizes various filter string aliases correctly', () => {
    expect(normalizeFilterType('peak')).toBe('peak');
    expect(normalizeFilterType('PEAK')).toBe('peak');
    expect(normalizeFilterType('low-shelf')).toBe('low-shelf');
    expect(normalizeFilterType('low_shelf')).toBe('low-shelf');
    expect(normalizeFilterType('ls')).toBe('low-shelf');
    expect(normalizeFilterType('high-shelf')).toBe('high-shelf');
    expect(normalizeFilterType('hsq')).toBe('high-shelf');
    expect(normalizeFilterType(undefined)).toBe('peak');
  });

  it('calculates biquad peak response at center frequency', () => {
    // Peak filter at 1000 Hz with +6 dB gain and Q=1.0. At 1000 Hz, response should be approx +6 dB.
    const centerResponse = calculateBiquadResponseDb(1000, 'peak', 1000, 6, 1.0);
    expect(centerResponse).toBeCloseTo(6.0, 0.5);

    // Far from center frequency (e.g. 100 Hz), response should approach 0 dB
    const farResponse = calculateBiquadResponseDb(100, 'peak', 1000, 6, 1.0);
    expect(farResponse).toBeCloseTo(0.0, 0.5);
  });

  it('returns 0 dB when peak filter gain is 0', () => {
    const resp = calculateBiquadResponseDb(1000, 'peak', 1000, 0, 1.0);
    expect(resp).toBe(0);
  });

  it('calculates low-shelf response correctly', () => {
    // Low-shelf at 200 Hz with +6 dB gain. Sub-bass (50 Hz) should receive full boost.
    const bassResp = calculateBiquadResponseDb(50, 'low-shelf', 200, 6, 0.7);
    expect(bassResp).toBeGreaterThan(4.0);

    // Far above shelf (5000 Hz) should be approx 0 dB
    const trebleResp = calculateBiquadResponseDb(5000, 'low-shelf', 200, 6, 0.7);
    expect(trebleResp).toBeCloseTo(0.0, 0.5);
  });

  it('converts between frequency and normalized logarithmic X coordinates roundtrip', () => {
    const f1 = 20;
    const f2 = 1000;
    const f3 = 20000;

    expect(freqToNormX(f1)).toBeCloseTo(0.0, 4);
    expect(freqToNormX(f3)).toBeCloseTo(1.0, 4);

    const norm1000 = freqToNormX(f2);
    expect(normXToFreq(norm1000)).toBeCloseTo(f2, 1);
  });

  it('generates a complete frequency response curve across spectrum', () => {
    const curve = generateFrequencyResponseCurve(
      [
        { id: '1', filter_type: 'peak', freq: 1000, gain_db: 5, q: 1.0, enabled: true },
      ],
      0,
      true,
      100
    );

    expect(curve.length).toBe(101);
    expect(curve[0].freq).toBeCloseTo(20, 1);
    expect(curve[100].freq).toBeCloseTo(20000, 1);
  });
});

describe('gainToNormY / normYToGain', () => {
  it('round-trips every gain in the default range', () => {
    for (let db = -24; db <= 12; db += 0.5) {
      expect(normYToGain(gainToNormY(db))).toBeCloseTo(db, 9);
    }
  });

  it('round-trips every position in a custom range', () => {
    for (let y = 0; y <= 1; y += 0.05) {
      expect(gainToNormY(normYToGain(y, -12, 12), -12, 12)).toBeCloseTo(y, 9);
    }
  });

  it('maps the top of the graph to the maximum gain and clamps out-of-range input', () => {
    expect(gainToNormY(12)).toBe(0);
    expect(gainToNormY(-24)).toBe(1);
    expect(gainToNormY(40)).toBe(0);
    expect(normYToGain(-0.5)).toBe(12);
    expect(normYToGain(2)).toBe(-24);
  });

  it('keeps frequency mapping monotonic across the audible range', () => {
    let prev = -1;
    for (const f of [20, 50, 100, 500, 1000, 5000, 10000, 20000]) {
      const x = freqToNormX(f);
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
    expect(normXToFreq(-1)).toBeCloseTo(20, 6);
    expect(normXToFreq(5)).toBeCloseTo(20000, 3);
  });
});
