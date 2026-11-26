// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmbienceMode } from './useAmbienceMode';
import { getTranslations } from '../i18n';

describe('useAmbienceMode', () => {
  const loc = getTranslations('en');
  let showMessage: any;

  beforeEach(() => {
    localStorage.clear();
    showMessage = vi.fn();
  });

  it('initializes with off mode by default', () => {
    const { result } = renderHook(() => useAmbienceMode({ loc, showMessage }));
    expect(result.current.ambienceMode).toBe('off');
  });

  it('cycles through ambience modes in sequence', () => {
    const { result } = renderHook(() => useAmbienceMode({ loc, showMessage }));

    act(() => {
      result.current.cycleAmbienceMode();
    });
    expect(result.current.ambienceMode).toBe('sakura');
    expect(showMessage).toHaveBeenCalledWith(loc.notifications.ambienceSakura);

    act(() => {
      result.current.cycleAmbienceMode();
    });
    expect(result.current.ambienceMode).toBe('neon_rain');
    expect(showMessage).toHaveBeenCalledWith(loc.notifications.ambienceNeon);
  });

  it('allows direct setting of ambience mode', () => {
    const { result } = renderHook(() => useAmbienceMode({ loc, showMessage }));

    act(() => {
      result.current.setAmbienceMode('matrix_rain');
    });
    expect(result.current.ambienceMode).toBe('matrix_rain');
  });
});
