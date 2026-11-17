import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThemeEngine } from './useThemeEngine';
import type { Theme } from '../types/theme';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('useThemeEngine hook', () => {
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
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useThemeEngine());
    expect(result.current.currentTheme).toBeNull();
    expect(result.current.themes).toEqual([]);
    expect(result.current.themeOverlay).toBe(0.4);
    expect(result.current.themeBlur).toBe(20);
    expect(result.current.appIconStyle).toBe('lineout');
  });

  it('updates CSS custom properties on DOM and state when applyThemeToDom is called', () => {
    const { result } = renderHook(() => useThemeEngine());

    act(() => {
      result.current.applyThemeToDom(sampleTheme);
    });

    expect(result.current.currentTheme?.id).toBe('cyberpunk_neon');
    expect(result.current.themeOverlay).toBe(0.5);
    expect(result.current.themeBlur).toBe(25);
    expect(document.documentElement.style.getPropertyValue('--accent-pink')).toBe('#ff007f');
    expect(document.documentElement.style.getPropertyValue('--bg-blur')).toBe('25px');
  });

  it('early returns cleanly when null is passed to applyThemeToDom', () => {
    const { result } = renderHook(() => useThemeEngine());

    act(() => {
      result.current.applyThemeToDom(null);
    });

    expect(result.current.currentTheme).toBeNull();
  });
});
