import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVolumeUnit } from './useVolumeUnit';
import { getTranslations } from '../i18n';

describe('useVolumeUnit', () => {
  const loc = getTranslations('en');
  const showMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with percent unit by default', () => {
    const { result } = renderHook(() => useVolumeUnit({ loc, showMessage }));
    expect(result.current.volumeUnit).toBe('percent');
    // Percent is the slider position on the cubic curve: gain 0.125 sits half way.
    expect(result.current.formatVolumeValue(0.125)).toBe('50%');
  });

  it('formats dB correctly when switched to db mode', () => {
    const { result } = renderHook(() => useVolumeUnit({ loc, showMessage }));

    act(() => {
      result.current.handleToggleVolumeUnit();
    });

    expect(result.current.volumeUnit).toBe('db');
    expect(result.current.formatVolumeValue(1.0)).toBe('0.0 dB');
    expect(result.current.formatVolumeValue(0.0)).toBe('-∞ dB');
    expect(showMessage).toHaveBeenCalled();
  });

  it('toggles back to percent from db', () => {
    const { result } = renderHook(() => useVolumeUnit({ loc, showMessage }));

    act(() => {
      result.current.handleSetVolumeUnit('db');
    });
    expect(result.current.volumeUnit).toBe('db');

    act(() => {
      result.current.handleToggleVolumeUnit();
    });
    expect(result.current.volumeUnit).toBe('percent');
  });

  it('defaults to the cubic curve and persists a switch to db-linear', () => {
    const { result } = renderHook(() => useVolumeUnit({ loc, showMessage }));
    expect(result.current.volumeCurve).toBe('cubic');

    act(() => {
      result.current.handleSetVolumeCurve('db-linear');
    });

    expect(result.current.volumeCurve).toBe('db-linear');
    expect(localStorage.getItem('auralune_volume_curve')).toBe('db-linear');
    // Same gain, new readout: -30 dB is half way on the dB-linear curve.
    expect(result.current.formatVolumeValue(10 ** (-30 / 20))).toBe('50%');
    expect(result.current.formatVolumeValue(10 ** (-30 / 20), 'db')).toBe('-30.0 dB');
    expect(showMessage).toHaveBeenCalledWith('Volume slider curve set to: dB-linear');
  });
});
