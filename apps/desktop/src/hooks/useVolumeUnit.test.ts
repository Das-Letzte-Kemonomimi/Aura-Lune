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
    expect(result.current.formatVolumeValue(0.75)).toBe('75%');
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
});
