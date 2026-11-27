import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useHotkeysManager } from './useHotkeysManager';
import { DEFAULT_PLAYBACK_STATUS } from '../types/player';
import { getTranslations, loadLocale } from '../i18n';
import { gainToPosition, positionToGain } from '../utils/volumeCurve';

describe('useHotkeysManager', () => {
  // Unmount every hook, so its window listener does not answer the next test's keys.
  afterEach(cleanup);

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
        handleToggleMute: vi.fn(),
        volumeCurve: 'cubic' as const,
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
        handleToggleMute: vi.fn(),
        volumeCurve: 'cubic' as const,
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

  it('uses the latest translations, formatter and handlers after a re-render', async () => {
    // Regression: a listener registered with an empty dependency list froze the values from the first render.
    const statusRef = { current: { ...DEFAULT_PLAYBACK_STATUS, volume: 1.0 } };
    const firstNotify = vi.fn();
    const latestNotify = vi.fn();
    const latestVolumeChange = vi.fn();
    const pl = await loadLocale('pl');

    const baseProps = {
      statusRef,
      handlePlayPause: vi.fn(),
      handleNext: vi.fn(),
      handlePrevious: vi.fn(),
      handleSeek: vi.fn(),
      handleToggleMute: vi.fn(),
      volumeCurve: 'cubic' as const,
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
    // One step down from full is 98% of the slider on the cubic curve.
    expect(latestVolumeChange).toHaveBeenCalledWith(positionToGain(0.98, 'cubic'));
    expect(latestNotify).toHaveBeenCalledWith(pl.notifications.volumeMsg.replace('{0}', '-0.5 dB'));
  });

  function renderWithVolume(volume: number, volumeCurve: 'cubic' | 'db-linear' = 'cubic') {
    const props = {
      statusRef: { current: { ...DEFAULT_PLAYBACK_STATUS, volume } },
      handlePlayPause: vi.fn(),
      handleNext: vi.fn(),
      handlePrevious: vi.fn(),
      handleSeek: vi.fn(),
      handleVolumeChange: vi.fn(),
      handleToggleMute: vi.fn(),
      volumeCurve,
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
      formatVolumeValue: (vol: number) => `${Math.round(vol * 100)}%`,
      showMessage: vi.fn(),
      t: getTranslations('en'),
    };
    renderHook(() => useHotkeysManager(props));
    return props;
  }

  it.each([
    [{}, 0.52],
    [{ shiftKey: true }, 0.505],
    [{ ctrlKey: true }, 0.55],
  ])('ArrowUp with %o steps the slider position to %f', (mods, expected) => {
    const props = renderWithVolume(positionToGain(0.5, 'cubic'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', ...mods }));
    expect(gainToPosition(props.handleVolumeChange.mock.lastCall![0], 'cubic')).toBeCloseTo(expected, 9);
  });

  it('ArrowDown follows the dB-linear curve and stops at mute', () => {
    const props = renderWithVolume(positionToGain(0.01, 'db-linear'), 'db-linear');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown' }));
    expect(props.handleVolumeChange).toHaveBeenCalledWith(0);
  });

  it('M toggles mute through handleToggleMute instead of jumping to full volume', () => {
    const props = renderWithVolume(0);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM' }));
    expect(props.handleToggleMute).toHaveBeenCalledTimes(1);
    expect(props.handleVolumeChange).not.toHaveBeenCalled();
    expect(props.showMessage).toHaveBeenCalledWith(props.t.notifications.unmutedMsg);
  });
});
