import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHotkeysManager } from './useHotkeysManager';
import { DEFAULT_PLAYBACK_STATUS } from '../types/player';
import { getTranslations } from '../i18n';

describe('useHotkeysManager', () => {
  it('triggers play/pause on Space keydown when not in input field', () => {
    const handlePlayPause = vi.fn();
    const statusRef = { current: { ...DEFAULT_PLAYBACK_STATUS } };
    const t = getTranslations('en');

    renderHook(() =>
      useHotkeysManager({
        statusRef,
        handlePlayPause,
        handleNext: vi.fn(),
        handlePrevious: vi.fn(),
        handleSeek: vi.fn(),
        handleVolumeChange: vi.fn(),
        handleToggleShuffle: vi.fn(),
        handleCycleLoopMode: vi.fn(),
        handlePitchChange: vi.fn(),
        handleTempoChange: vi.fn(),
        handleResetDsp: vi.fn(),
        toggleMiniPlayer: vi.fn(),
        setIsBigScreen: vi.fn(),
        setIsSettingsOpen: vi.fn(),
        setIsQueueOpen: vi.fn(),
        setIsQuickLoadOpen: vi.fn(),
        setShowPlaylistModal: vi.fn(),
        setIsScanFolderOpen: vi.fn(),
        setIsShortcutsModalOpen: vi.fn(),
        setIsCommandPaletteOpen: vi.fn(),
        setShowLyrics: vi.fn(),
        setLoopPointA: vi.fn(),
        setLoopPointB: vi.fn(),
        setActiveTab: vi.fn(),
        handleIncreaseScale: vi.fn(),
        handleDecreaseScale: vi.fn(),
        handleResetScale: vi.fn(),
        formatTime: (ms) => `${ms}ms`,
        formatVolumeValue: (vol) => `${Math.round(vol * 100)}%`,
        showMessage: vi.fn(),
        t,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
    expect(handlePlayPause).toHaveBeenCalledTimes(1);
  });

  it('triggers next/previous on ArrowRight/ArrowLeft with ctrlKey', () => {
    const handleNext = vi.fn();
    const handlePrevious = vi.fn();
    const statusRef = { current: { ...DEFAULT_PLAYBACK_STATUS } };
    const t = getTranslations('en');

    renderHook(() =>
      useHotkeysManager({
        statusRef,
        handlePlayPause: vi.fn(),
        handleNext,
        handlePrevious,
        handleSeek: vi.fn(),
        handleVolumeChange: vi.fn(),
        handleToggleShuffle: vi.fn(),
        handleCycleLoopMode: vi.fn(),
        handlePitchChange: vi.fn(),
        handleTempoChange: vi.fn(),
        handleResetDsp: vi.fn(),
        toggleMiniPlayer: vi.fn(),
        setIsBigScreen: vi.fn(),
        setIsSettingsOpen: vi.fn(),
        setIsQueueOpen: vi.fn(),
        setIsQuickLoadOpen: vi.fn(),
        setShowPlaylistModal: vi.fn(),
        setIsScanFolderOpen: vi.fn(),
        setIsShortcutsModalOpen: vi.fn(),
        setIsCommandPaletteOpen: vi.fn(),
        setShowLyrics: vi.fn(),
        setLoopPointA: vi.fn(),
        setLoopPointB: vi.fn(),
        setActiveTab: vi.fn(),
        handleIncreaseScale: vi.fn(),
        handleDecreaseScale: vi.fn(),
        handleResetScale: vi.fn(),
        formatTime: (ms) => `${ms}ms`,
        formatVolumeValue: (vol) => `${Math.round(vol * 100)}%`,
        showMessage: vi.fn(),
        t,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', ctrlKey: true }));
    expect(handleNext).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', ctrlKey: true }));
    expect(handlePrevious).toHaveBeenCalledTimes(1);
  });
});
