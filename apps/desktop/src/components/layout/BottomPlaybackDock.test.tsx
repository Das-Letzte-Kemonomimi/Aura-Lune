import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BottomPlaybackDock, type BottomPlaybackDockProps } from './BottomPlaybackDock';
import { getTranslations } from '../../i18n';
import { DEFAULT_PLAYBACK_STATUS } from '../../types/player';

describe('BottomPlaybackDock component', () => {
  afterEach(() => {
    cleanup();
  });

  const loc = getTranslations('en');

  const defaultProps: BottomPlaybackDockProps = {
    isVisible: true,
    activeTab: 'library',
    language: 'en',
    loc,
    status: {
      ...DEFAULT_PLAYBACK_STATUS,
      state: 'Playing',
      position_ms: 30000,
      duration_ms: 180000,
      volume: 0.8,
    },
    currentPlayingTrack: {
      id: 1,
      path: '/music/song.flac',
      title: 'Echoes in the Rain',
      artist: 'Aura Lune',
      duration_ms: 180000,
    } as any,
    effectiveDisplayTitle: 'Echoes in the Rain',
    effectiveDisplayArtist: 'Aura Lune',
    currentCover: null,
    filePath: '/music/song.flac',
    queue: {
      items: [],
      current_index: 0,
      loop_mode: 'None',
      shuffle: false,
      shuffle_order: [],
      shuffle_cursor: 0,
    },
    volumeProgressPercent: 80,
    formatTime: (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`,
    onScrollToTopOrSwitchTab: vi.fn(),
    onOpenContainingFolder: vi.fn(),
    onToggleShuffle: vi.fn(),
    onPrevious: vi.fn(),
    onPlayPause: vi.fn(),
    onNext: vi.fn(),
    onCycleLoopMode: vi.fn(),
    onToggleStopAfterCurrent: vi.fn(),
    onSeek: vi.fn(),
    onSeekPreview: vi.fn(),
    onSeekCommit: vi.fn(),
    onCycleDspEngine: vi.fn(),
    onSelectDspEngine: vi.fn(),
    onToggleMute: vi.fn(),
    onVolumeChange: vi.fn(),
    onToggleMiniPlayer: vi.fn(),
  };

  it('renders nothing when isVisible is false', () => {
    const { container } = render(
      <BottomPlaybackDock {...defaultProps} isVisible={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders track title, artist, and triggers playback actions', () => {
    const onPlayPause = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();

    render(
      <BottomPlaybackDock
        {...defaultProps}
        onPlayPause={onPlayPause}
        onNext={onNext}
        onPrevious={onPrevious}
      />
    );

    expect(screen.getByText('Echoes in the Rain')).toBeDefined();
    expect(screen.getByText('Aura Lune')).toBeDefined();

    // Play/Pause button strictly matching "Pause"
    const playPauseBtn = screen.getByRole('button', { name: /^pause$/i });
    fireEvent.click(playPauseBtn);
    expect(onPlayPause).toHaveBeenCalledTimes(1);

    // Next track button
    const nextBtn = screen.getByRole('button', { name: /^next track$/i });
    fireEvent.click(nextBtn);
    expect(onNext).toHaveBeenCalledTimes(1);

    // Previous track button
    const prevBtn = screen.getByRole('button', { name: /^previous track$/i });
    fireEvent.click(prevBtn);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('fires onSeekPreview during slider drag and onSeekCommit on pointer up and keyboard navigation', () => {
    const onSeekPreview = vi.fn();
    const onSeekCommit = vi.fn();

    render(
      <BottomPlaybackDock
        {...defaultProps}
        onSeekPreview={onSeekPreview}
        onSeekCommit={onSeekCommit}
      />
    );

    // Seek bar slider
    const sliders = screen.getAllByRole('slider');
    const seekSlider = sliders[0]; // first slider is seek progress, second is volume

    // Change value (dragging)
    fireEvent.change(seekSlider, { target: { value: '90000' } });
    expect(onSeekPreview).toHaveBeenCalledWith(90000);

    // Release pointer with target value
    fireEvent.pointerUp(seekSlider, { target: { value: '90000' } });
    expect(onSeekCommit).toHaveBeenCalledWith(90000);

    // Keyboard navigation (ArrowRight)
    fireEvent.keyUp(seekSlider, { key: 'ArrowRight', target: { value: '95000' } });
    expect(onSeekCommit).toHaveBeenCalledWith(95000);
  });

  it('triggers onToggleMute when clicking volume icon button', () => {
    const onToggleMute = vi.fn();

    render(
      <BottomPlaybackDock
        {...defaultProps}
        onToggleMute={onToggleMute}
      />
    );

    // Volume button (title="Volume")
    const muteBtn = screen.getByRole('button', { name: /^volume$/i });
    fireEvent.click(muteBtn);
    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });
});
