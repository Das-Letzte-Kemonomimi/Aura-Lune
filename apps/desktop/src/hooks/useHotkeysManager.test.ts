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

  it('uses the latest translations, formatter and handlers after a re-render', () => {
    // Regresja: nasłuch rejestrowany z pustą listą zależności zamrażał wartości z pierwszego renderu.
    const statusRef = { current: { ...DEFAULT_PLAYBACK_STATUS, volume: 1.0 } };
    const firstNotify = vi.fn();
    const latestNotify = vi.fn();
    const latestVolumeChange = vi.fn();
    const pl = getTranslations('pl');

    const baseProps = {
      statusRef,
      handlePlayPause: vi.fn(),
      handleNext: vi.fn(),
      handlePrevious: vi.fn(),
      handleSeek: vi.fn(),
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
      formatTime: (ms: number) => `${ms}ms`,
    };

    const { rerender } = renderHook((props) => useHotkeysManager(props), {
      initialProps: {
        ...baseProps,
        handleVolumeChange: vi.fn(),
        formatVolumeValue: (vol: number) => `${Math.round(vol * 100)}%`,
        showMessage: firstNotify,
        t: getTranslations('en'),
      },
    });

    rerender({
      ...baseProps,
      handleVolumeChange: latestVolumeChange,
      formatVolumeValue: (vol: number) => `${(20 * Math.log10(vol)).toFixed(1)} dB`,
      showMessage: latestNotify,
      t: pl,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown' }));

    expect(firstNotify).not.toHaveBeenCalled();
    expect(latestVolumeChange).toHaveBeenCalledWith(0.95);
    const expected = pl.notifications.volumeMsg.replace('{0}%', '-0.4 dB').replace('{0}', '-0.4 dB');
    expect(latestNotify).toHaveBeenCalledWith(expected);
  });
});
