import { describe, expect, it } from 'vitest';
import {
  formatVolume,
  gainToDb,
  gainToPosition,
  positionToGain,
  stepVolumeGain,
  VOLUME_CURVES,
  volumeIconFor,
  volumeStepSize,
  wheelVolumeStep,
} from './volumeCurve';

const GRID = Array.from({ length: 101 }, (_, i) => i / 100);

describe('volumeCurve endpoints', () => {
  it('cubic: half way is about -18 dB', () => {
    expect(gainToDb(positionToGain(0.5, 'cubic'))).toBeCloseTo(-18.06, 2);
  });

  it('db-linear: half way is -30 dB', () => {
    expect(gainToDb(positionToGain(0.5, 'db-linear'))).toBeCloseTo(-30, 9);
  });

  it.each(VOLUME_CURVES)('%s: full is 0 dB and zero is mute', (curve) => {
    expect(positionToGain(1, curve)).toBe(1);
    expect(gainToDb(positionToGain(1, curve))).toBe(0);
    expect(positionToGain(0, curve)).toBe(0);
    expect(gainToDb(positionToGain(0, curve))).toBe(-Infinity);
  });

  it.each(VOLUME_CURVES)('%s: never boosts above unity and clamps bad input', (curve) => {
    expect(positionToGain(1.5, curve)).toBe(1);
    expect(positionToGain(-1, curve)).toBe(0);
    expect(positionToGain(Number.NaN, curve)).toBe(0);
    expect(gainToPosition(2, curve)).toBe(1);
    expect(gainToPosition(-0.1, curve)).toBe(0);
  });

  it('db-linear: gains below the -60 dB floor map to position 0', () => {
    expect(gainToPosition(10 ** (-80 / 20), 'db-linear')).toBe(0);
  });
});

describe('volumeCurve invariants', () => {
  it.each(VOLUME_CURVES)('%s: position round-trips through gain', (curve) => {
    for (const p of GRID) {
      expect(gainToPosition(positionToGain(p, curve), curve)).toBeCloseTo(p, 9);
    }
  });

  it.each(VOLUME_CURVES)('%s: gain rises strictly with position', (curve) => {
    for (let i = 1; i < GRID.length; i++) {
      expect(positionToGain(GRID[i], curve)).toBeGreaterThan(positionToGain(GRID[i - 1], curve));
    }
  });
});

describe('volume steps', () => {
  it('uses 2% by default, 0.5% with Shift and 5% with Ctrl', () => {
    expect(volumeStepSize({})).toBe(0.02);
    expect(volumeStepSize({ shiftKey: true })).toBe(0.005);
    expect(volumeStepSize({ ctrlKey: true })).toBe(0.05);
    expect(volumeStepSize({ ctrlKey: true, shiftKey: true })).toBe(0.05);
  });

  it('wheel up is louder, wheel down quieter, no delta no step', () => {
    expect(wheelVolumeStep(-100, {})).toBe(0.02);
    expect(wheelVolumeStep(100, { shiftKey: true })).toBe(-0.005);
    expect(wheelVolumeStep(-3, { ctrlKey: true })).toBe(0.05);
    expect(wheelVolumeStep(0, {})).toBe(0);
  });

  it('steps by slider position, not by gain, and stays in range', () => {
    const half = positionToGain(0.5, 'cubic');
    expect(gainToPosition(stepVolumeGain(half, 0.02, 'cubic'), 'cubic')).toBeCloseTo(0.52, 9);
    expect(stepVolumeGain(1, 0.05, 'cubic')).toBe(1);
    expect(stepVolumeGain(0, -0.02, 'db-linear')).toBe(0);
  });

  it('up then down returns to the same gain', () => {
    const start = positionToGain(0.37, 'db-linear');
    const back = stepVolumeGain(stepVolumeGain(start, 0.02, 'db-linear'), -0.02, 'db-linear');
    expect(back).toBeCloseTo(start, 12);
  });
});

describe('volumeIconFor', () => {
  it('maps positions to the four speaker states', () => {
    expect(volumeIconFor(0)).toBe('mute');
    expect(volumeIconFor(0.01)).toBe('low');
    expect(volumeIconFor(0.329)).toBe('low');
    expect(volumeIconFor(0.33)).toBe('mid');
    expect(volumeIconFor(0.659)).toBe('mid');
    expect(volumeIconFor(0.66)).toBe('high');
    expect(volumeIconFor(1)).toBe('high');
  });
});

describe('formatVolume', () => {
  it('shows the slider position as percent', () => {
    expect(formatVolume(positionToGain(0.5, 'cubic'), 'percent', 'cubic')).toBe('50%');
    expect(formatVolume(positionToGain(0.5, 'db-linear'), 'percent', 'db-linear')).toBe('50%');
    expect(formatVolume(0.125, 'percent', 'db-linear')).toBe('70%');
  });

  it('shows the real gain in dB', () => {
    expect(formatVolume(0.125, 'db', 'cubic')).toBe('-18.1 dB');
    expect(formatVolume(1, 'db', 'cubic')).toBe('0.0 dB');
    expect(formatVolume(0, 'db', 'cubic')).toBe('-∞ dB');
  });

  it('has a compact form', () => {
    expect(formatVolume(0.125, 'db', 'cubic', { compact: true })).toBe('-18dB');
    expect(formatVolume(1, 'db', 'cubic', { compact: true })).toBe('0dB');
    expect(formatVolume(0, 'db', 'cubic', { compact: true })).toBe('-∞');
  });
});
