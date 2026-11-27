import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThemeManager } from './useThemeManager';
import { getTranslations } from '../i18n';
import type { Theme } from '../types/theme';


describe('useThemeManager hook', () => {
  const loc = getTranslations('en');
  const showMessage = vi.fn();

  const sampleTheme: Theme = {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Neon',
    schema_version: 1,
    tokens: {
      bg_deep: '#0a0a12',
      bg_surface: '#161626',
      bg_surface_hover: '#222238',
      bg_card: '#1c1c30',
      border_subtle: '#2a2a44',
      border_accent: '#ff0055',
      accent_pink: '#ff007f',
      accent_purple: '#8a2be2',
      accent_cyan: '#00ffff',
      accent_green: '#00ff7f',
      accent_amber: '#ffbf00',
      text_primary: '#ffffff',
      text_secondary: '#b0b0cc',
      text_muted: '#707088',
      shadow_glow: 'rgba(255, 0, 127, 0.4)',
      shadow_card: 'rgba(0, 0, 0, 0.6)',
    },
    background_ref: null,
    overlay_opacity: 0.5,
    blur_radius: 25,
    attribution: 'Tester',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with default UI scale and theme state', () => {
    const { result } = renderHook(() => useThemeManager({ showMessage, loc }));
    expect(result.current.uiScale).toBe(1.0);
    expect(result.current.currentTheme).toBeNull();
    expect(result.current.themes).toEqual([]);
    expect(result.current.themeOverlay).toBe(0.4);
    expect(result.current.themeBlur).toBe(8.0);
    expect(result.current.appIconStyle).toBe('lineout');
  });

  it('cycles UI scale through increase, decrease, and reset', () => {
    const { result } = renderHook(() => useThemeManager({ showMessage, loc }));

    act(() => {
      result.current.handleIncreaseScale();
    });
    expect(result.current.uiScale).toBe(1.10);

    act(() => {
      result.current.handleDecreaseScale();
    });
    expect(result.current.uiScale).toBe(1.0);

    act(() => {
      result.current.handleSelectScale(1.30);
    });
    expect(result.current.uiScale).toBe(1.30);
    expect(result.current.layoutMaxWidth).toBe('min(2350px, 98.5vw)');

    act(() => {
      result.current.handleResetScale();
    });
    expect(result.current.uiScale).toBe(1.0);
    expect(result.current.layoutMaxWidth).toBe('min(1500px, 95vw)');
  });

  it('updates DOM properties when applyThemeToDom is called', () => {
    const { result } = renderHook(() => useThemeManager({ showMessage, loc }));

    act(() => {
      result.current.applyThemeToDom(sampleTheme);
    });

    expect(result.current.currentTheme?.id).toBe('cyberpunk_neon');
    expect(document.documentElement.style.getPropertyValue('--accent-pink')).toBe('#ff007f');
    expect(document.documentElement.style.getPropertyValue('--bg-overlay')).toBe('0.5');
    expect(document.documentElement.style.getPropertyValue('--bg-blur')).toBe('25px');
  });
});
