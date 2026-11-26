import { describe, expect, it } from 'vitest';
import {
  autoPreampDb,
  clampPreampDb,
  formatSignedDb,
  parseFiniteSetting,
  preampStepSize,
  stepPreampDb,
  wheelPreampStep,
} from './preamp';

describe('preamp steps', () => {
  it('steps 0.5 dB, or 0.1 dB with Shift', () => {
    expect(preampStepSize({})).toBe(0.5);
    expect(preampStepSize({ shiftKey: true })).toBe(0.1);
  });

  it('maps wheel direction to the sign of the step', () => {
    expect(wheelPreampStep(-100, {})).toBe(0.5);
    expect(wheelPreampStep(100, { shiftKey: true })).toBe(-0.1);
    expect(wheelPreampStep(0, {})).toBe(0);
  });

  it('rounds to 0.1 dB so repeated fine steps do not drift', () => {
    let db = 0;
    for (let i = 0; i < 7; i += 1) db = stepPreampDb(db, 0.1);
    expect(db).toBe(0.7);
    for (let i = 0; i < 7; i += 1) db = stepPreampDb(db, -0.1);
    expect(db).toBe(0);
  });

  it('clamps to ±15 dB', () => {
    expect(stepPreampDb(14.8, 0.5)).toBe(15);
    expect(stepPreampDb(-14.8, -0.5)).toBe(-15);
    expect(clampPreampDb(Number.NaN)).toBe(0);
  });
});

describe('formatSignedDb', () => {
  it('always shows the sign and one decimal', () => {
    expect(formatSignedDb(3.5)).toBe('+3.5 dB');
    expect(formatSignedDb(-6)).toBe('-6.0 dB');
    expect(formatSignedDb(0)).toBe('0.0 dB');
    expect(formatSignedDb(-0.04)).toBe('0.0 dB');
  });
});

describe('autoPreampDb', () => {
  it('cuts by the largest band boost', () => {
    expect(autoPreampDb([0, 6, -3, 2, 0, 0, 0, 0, 0, 0])).toBe(-6);
    expect(autoPreampDb([1.5, 0.5])).toBe(-1.5);
  });

  it('is 0 dB when no band is boosted', () => {
    expect(autoPreampDb([0, -4, -12])).toBe(0);
    expect(autoPreampDb([])).toBe(0);
  });
});

describe('parseFiniteSetting', () => {
  it('keeps a saved 0 instead of falling back', () => {
    expect(parseFiniteSetting('0', -6)).toBe(0);
    expect(parseFiniteSetting('0.0', -6)).toBe(0);
  });

  it('parses signed values', () => {
    expect(parseFiniteSetting('-4.5', -6)).toBe(-4.5);
    expect(parseFiniteSetting('3', 0)).toBe(3);
  });

  it('falls back on missing or invalid input', () => {
    expect(parseFiniteSetting(null, -6)).toBe(-6);
    expect(parseFiniteSetting(undefined, -6)).toBe(-6);
    expect(parseFiniteSetting('', -6)).toBe(-6);
    expect(parseFiniteSetting('abc', -6)).toBe(-6);
    expect(parseFiniteSetting('NaN', -6)).toBe(-6);
  });
});
