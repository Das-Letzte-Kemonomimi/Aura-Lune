// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';
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

describe('useAmbienceMode persistence', () => {
  const loc = getTranslations('en');

  beforeEach(() => localStorage.clear());

  it('saves the mode when it is set directly (no second write needed by callers)', () => {
    const { result } = renderHook(() => useAmbienceMode({ loc, showMessage: vi.fn() }));
    act(() => result.current.setAmbienceMode('snow'));
    expect(localStorage.getItem('auralune_ambience_mode')).toBe('snow');
  });

  it('saves the mode when cycling and restores it on the next mount', () => {
    const first = renderHook(() => useAmbienceMode({ loc, showMessage: vi.fn() }));
    act(() => first.result.current.cycleAmbienceMode());
    expect(localStorage.getItem('auralune_ambience_mode')).toBe('sakura');
    first.unmount();

    const second = renderHook(() => useAmbienceMode({ loc, showMessage: vi.fn() }));
    expect(second.result.current.ambienceMode).toBe('sakura');
  });

  it('ignores an unknown saved mode', () => {
    localStorage.setItem('auralune_ambience_mode', 'confetti');
    const { result } = renderHook(() => useAmbienceMode({ loc, showMessage: vi.fn() }));
    expect(result.current.ambienceMode).toBe('off');
  });

  it('cycles through all nine modes and wraps back to off', () => {
    const { result } = renderHook(() => useAmbienceMode({ loc, showMessage: vi.fn() }));
    for (let i = 0; i < 9; i++) act(() => result.current.cycleAmbienceMode());
    expect(result.current.ambienceMode).toBe('off');
  });

  it('shows the toast once per cycle even under StrictMode', () => {
    const showMessage = vi.fn();
    const { result } = renderHook(() => useAmbienceMode({ loc, showMessage }), { wrapper: StrictMode });
    act(() => result.current.cycleAmbienceMode());
    expect(showMessage).toHaveBeenCalledTimes(1);
  });
});
