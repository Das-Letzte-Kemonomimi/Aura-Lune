// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppHeaderProps } from './useAppHeaderProps';
import { getTranslations } from '../../i18n';

describe('useAppHeaderProps', () => {
  it('bundles AppHeader props correctly from managers and state', () => {
    const loc = getTranslations('en');
    const mockThemeManager: any = {
      appIconStyle: 'classic',
      uiScale: 1.0,
      handleIncreaseScale: vi.fn(),
      handleDecreaseScale: vi.fn(),
    };
    const mockModalManager: any = {
      setIsRecapModalOpen: vi.fn(),
      setIsKeyBpmModalOpen: vi.fn(),
      setIsAnalysisModalOpen: vi.fn(),
      setIsSoundscapeOpen: vi.fn(),
      setIsHarmonicSuggesterOpen: vi.fn(),
      setIsCommandPaletteOpen: vi.fn(),
      isSettingsOpen: false,
      setIsSettingsOpen: vi.fn(),
    };

    const { result } = renderHook(() =>
      useAppHeaderProps({
        appVersion: '1.2.0',
        themeManager: mockThemeManager,
        modalManager: mockModalManager,
        activeTab: 'player',
        setActiveTab: vi.fn(),
        tracks: [],
        playlists: [],
        queue: { items: [] } as any,
        language: 'en',
        setLanguage: vi.fn(),
        loc,
        sleepTimerRemainingSec: null,
        sleepTimerTargetMode: null,
        setIsSleepTimerOpen: vi.fn(),
        showLyrics: false,
        setShowLyrics: vi.fn(),
        showDesktopLyrics: false,
        toggleDesktopLyrics: vi.fn(),
        ambienceMode: 'off',
        cycleAmbienceMode: vi.fn(),
        setIsBigScreen: vi.fn(),
        toggleMiniPlayer: vi.fn(),
        isQueueOpen: false,
        setIsQueueOpen: vi.fn(),
      })
    );

    expect(result.current.appVersion).toBe('1.2.0');
    expect(result.current.appIconStyle).toBe('classic');
    expect(result.current.trackCount).toBe(0);
    expect(result.current.isSettingsOpen).toBe(false);

    result.current.onOpenSettings();
    expect(mockModalManager.setIsSettingsOpen).toHaveBeenCalledWith(true);

    result.current.onOpenRecap();
    expect(mockModalManager.setIsRecapModalOpen).toHaveBeenCalledWith(true);
  });
});
