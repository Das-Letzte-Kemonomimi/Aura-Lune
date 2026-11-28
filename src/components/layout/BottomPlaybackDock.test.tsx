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
    formatVolumeValue: (gain: number) => `${Math.round(gain * 100)}%`,
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

  it('wires transport toggles, folder action, DSP popover menu, and view controls', () => {
    const onToggleShuffle = vi.fn();
    const onCycleLoopMode = vi.fn();
    const onToggleStopAfterCurrent = vi.fn();
    const onOpenContainingFolder = vi.fn();
    const onCycleDspEngine = vi.fn();
    const onSelectDspEngine = vi.fn();
    const onScrollToTopOrSwitchTab = vi.fn();
    const onToggleMiniPlayer = vi.fn();

    render(
      <BottomPlaybackDock
        {...defaultProps}
        status={{
          ...defaultProps.status,
          engine: 'RubberBand',
          pitch_semitones: 2,
          tempo_ratio: 1.15,
        }}
        onToggleShuffle={onToggleShuffle}
        onCycleLoopMode={onCycleLoopMode}
        onToggleStopAfterCurrent={onToggleStopAfterCurrent}
        onOpenContainingFolder={onOpenContainingFolder}
        onCycleDspEngine={onCycleDspEngine}
        onSelectDspEngine={onSelectDspEngine}
        onScrollToTopOrSwitchTab={onScrollToTopOrSwitchTab}
        onToggleMiniPlayer={onToggleMiniPlayer}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: loc.player.shuffleOff }));
    expect(onToggleShuffle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: loc.player.loopOff }));
    expect(onCycleLoopMode).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: loc.bottomDock.stopAfterCurrentOff }));
    expect(onToggleStopAfterCurrent).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: loc.queue.openContainingFolder }));
    expect(onOpenContainingFolder).toHaveBeenCalledWith('/music/song.flac', expect.anything());

    expect(screen.getByText('+2 st')).toBeDefined();
    expect(screen.getByText('1.15x')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /rubber band/i }));
    expect(onCycleDspEngine).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: loc.bottomDock.selectDspEngineList }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /soundtouch/i }));
    expect(onSelectDspEngine).toHaveBeenCalledWith('SoundTouch');

    fireEvent.click(screen.getByRole('button', { name: loc.bottomDock.openFullPlayer }));
    expect(onScrollToTopOrSwitchTab).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: loc.bottomDock.maximizeTooltip }));
    expect(onToggleMiniPlayer).toHaveBeenCalledTimes(1);
  });

  describe('DSP bypass indicator', () => {
    const withEngine = (engine: 'Bypass' | 'RubberBand') => ({
      ...defaultProps,
      status: { ...defaultProps.status, engine, pitch_semitones: 2, tempo_ratio: 1.15 },
    });

    it('greys out the engine pill and effect badges while bypass is on', () => {
      const { container } = render(<BottomPlaybackDock {...withEngine('Bypass')} />);
      const pill = container.querySelector('[data-bypassed]');
      expect(pill).not.toBeNull();
      expect(pill?.className).toContain('opacity-60');
      expect(pill?.className).not.toContain('text-accent-green');
      const pitch = screen.getByText('+2 st');
      expect(pitch.className).toContain('opacity-60');
      expect(pitch.className).not.toContain('text-accent-pink');
      expect(pitch.getAttribute('title')).toContain(loc.bottomDock.bypassedTooltip);
      expect(screen.getByText('1.15x').getAttribute('title')).toContain(loc.bottomDock.bypassedTooltip);
    });

    it('keeps the accent colours when a DSP engine is active', () => {
      const { container } = render(<BottomPlaybackDock {...withEngine('RubberBand')} />);
      expect(container.querySelector('[data-bypassed]')).toBeNull();
      const pitch = screen.getByText('+2 st');
      expect(pitch.className).toContain('text-accent-pink');
      expect(pitch.className).not.toContain('opacity-60');
    });
  });

  it('shows a seekable slider with a duration for a normal track', () => {
    render(<BottomPlaybackDock {...defaultProps} />);
    expect(screen.getByRole('slider', { name: loc.bottomDock.seekLabel })).toBeDefined();
    expect(screen.queryByText(loc.bottomDock.live)).toBeNull();
    expect(screen.getByText('3:00')).toBeDefined();
  });

  it('shows a LIVE badge and no seek slider when the stream has no duration', () => {
    render(
      <BottomPlaybackDock
        {...defaultProps}
        status={{ ...defaultProps.status, state: 'Playing', position_ms: 0, duration_ms: null }}
      />
    );
    expect(screen.getByText(loc.bottomDock.live)).toBeDefined();
    expect(screen.queryByRole('slider', { name: loc.bottomDock.seekLabel })).toBeNull();
  });

  it('shows LIVE for an http stream source even if a duration is reported', () => {
    render(
      <BottomPlaybackDock
        {...defaultProps}
        filePath="https://x.test/stream"
      />
    );
    expect(screen.getByText(loc.bottomDock.live)).toBeDefined();
    expect(screen.queryByRole('slider', { name: loc.bottomDock.seekLabel })).toBeNull();
  });
});
