import { describe, expect, it } from 'vitest';
import { loopPointInputText, validateLoopInputs } from './loopEditorModel';

describe('validateLoopInputs', () => {
  it('accepts A < B in m:ss.mmm and reports the loop length', () => {
    const v = validateLoopInputs('0:38.000', '0:43.250', 200_000);
    expect(v.canApply).toBe(true);
    expect(v.parsedA).toBe(38_000);
    expect(v.parsedB).toBe(43_250);
    expect(v.loopDurationMs).toBe(5_250);
  });

  it('rejects B equal to or before A', () => {
    expect(validateLoopInputs('0:10.000', '0:10.000', null)).toMatchObject({ isOrderValid: false, canApply: false });
    expect(validateLoopInputs('0:10.000', '0:05.000', null).canApply).toBe(false);
  });

  it('rejects unparsable text', () => {
    const v = validateLoopInputs('abc', '0:05.000', null);
    expect(v.isAValid).toBe(false);
    expect(v.canApply).toBe(false);
  });

  it('allows one open-ended point', () => {
    const v = validateLoopInputs('0:10.000', '', null);
    expect(v.canApply).toBe(true);
    expect(v.loopDurationMs).toBeNull();
  });

  it('rejects points beyond the track length', () => {
    const v = validateLoopInputs('0:10.000', '5:00.000', 120_000);
    expect(v.isWithinTrack).toBe(false);
    expect(v.canApply).toBe(false);
  });
});

describe('loopPointInputText', () => {
  it('formats a point as m:ss.mmm and an unset point as empty text', () => {
    expect(loopPointInputText(83_450)).toBe('1:23.450');
    expect(loopPointInputText(null)).toBe('');
  });
});
