// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBottomPlaybackDockProps } from './useBottomPlaybackDockProps';
import { getTranslations } from '../../i18n';
import { DEFAULT_PLAYBACK_STATUS } from '../../types/player';

describe('useBottomPlaybackDockProps', () => {
  it('computes isVisible correctly and bundles action handlers', () => {
    const loc = getTranslations('en');
    const mockPlaybackController: any = {
      handleToggleShuffle: vi.fn(),
      handlePrevious: vi.fn(),
      handlePlayPause: vi.fn(),
      handleNext: vi.fn(),
      handleCycleLoopMode: vi.fn(),
      handleToggleStopAfterCurrent: vi.fn(),
      handleSeek: vi.fn(),
      handleToggleMute: vi.fn(),
      handleVolumeChange: vi.fn(),
    };
    const mockDspManager: any = {
      handleCycleDspEngine: vi.fn(),
      handleEngineChange: vi.fn(),
    };

    const { result, rerender } = renderHook(
      (props: any) => useBottomPlaybackDockProps(props),
      {
        initialProps: {
          activeTab: 'player',
          isPlayerScrolledDown: false,
          status: DEFAULT_PLAYBACK_STATUS,
          currentPlayingTrack: null,
          filePath: '',
          language: 'en' as const,
          loc,
          effectiveDisplayTitle: 'Title',
          effectiveDisplayArtist: 'Artist',
          currentCover: null,
          queue: { items: [] } as any,
          formatTime: vi.fn(),
          mainContentRef: { current: null },
          setActiveTab: vi.fn(),
          handleOpenContainingFolder: vi.fn(),
          playbackController: mockPlaybackController,
          dspManager: mockDspManager,
          toggleMiniPlayer: vi.fn(),
        },
      }
    );

    // On player tab without scroll and when stopped, dock is not visible
    expect(result.current.isVisible).toBe(false);

    // When playing on another tab, dock becomes visible
    rerender({
      activeTab: 'library',
      isPlayerScrolledDown: false,
      status: { ...DEFAULT_PLAYBACK_STATUS, state: 'Playing' },
      currentPlayingTrack: { id: 1 } as any,
      filePath: '/path/song.flac',
      language: 'en' as const,
      loc,
      effectiveDisplayTitle: 'Title',
      effectiveDisplayArtist: 'Artist',
      currentCover: null,
      queue: { items: [] } as any,
      formatTime: vi.fn(),
      mainContentRef: { current: null },
      setActiveTab: vi.fn(),
      handleOpenContainingFolder: vi.fn(),
      playbackController: mockPlaybackController,
      dspManager: mockDspManager,
      toggleMiniPlayer: vi.fn(),
    });

    expect(result.current.isVisible).toBe(true);

    result.current.onPlayPause();
    expect(mockPlaybackController.handlePlayPause).toHaveBeenCalled();
  });
});
