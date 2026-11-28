import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlayerTransportControls, type PlayerTransportControlsProps } from './PlayerTransportControls';
import { DEFAULT_PLAYBACK_STATUS } from '../../../types/player';
import { getTranslations } from '../../../i18n';

afterEach(cleanup);

function makeProps(overrides: Partial<PlayerTransportControlsProps> = {}): PlayerTransportControlsProps {
  return {
    activeTrackId: 1,
    currentBookmark: null,
    currentTrackBookmarks: [],
    formatTime: (ms) => `${Math.floor(ms / 1000)}s`,
    formatTimeMs: (ms) => `${ms}ms`,
    formatVolumeValue: (vol) => `${Math.round(vol * 100)}%`,
    handleCycleLoopMode: vi.fn(),
    handleDeleteBookmark: vi.fn(),
    handleJumpToBookmark: vi.fn(),
    handleNext: vi.fn(),
    handlePlayPause: vi.fn(),
    handleSaveBookmark: vi.fn(),
    handleToggleMute: vi.fn(),
    handlePrevious: vi.fn(),
    handleToggleShuffle: vi.fn(),
    handleToggleStopAfterCurrent: vi.fn(),
    handleToggleVolumeUnit: vi.fn(),
    handleVolumeChange: vi.fn(),
    loc: getTranslations('en'),
    loopPointA: null,
    loopPointB: null,
    queue: {
      items: [],
      current_index: 0,
      shuffle: false,
      loop_mode: 'None',
      shuffle_order: [],
      shuffle_cursor: 0,
    },
    setIsBookmarksModalOpen: vi.fn(),
    setIsLoopEditorOpen: vi.fn(),
    setIsShortcutsModalOpen: vi.fn(),
    setLoopPointA: vi.fn(),
    setLoopPointB: vi.fn(),
    setShowLyrics: vi.fn(),
    showLyrics: false,
    showMessage: vi.fn(),
    status: { ...DEFAULT_PLAYBACK_STATUS, state: 'Paused', volume: 0.8 },
    volumeUnit: 'percent',
    ...overrides,
  };
}

describe('PlayerTransportControls', () => {
  it('places the media transport buttons in a centered zone separate from utility tools and volume', () => {
    const loc = getTranslations('en');
    const handlePlayPause = vi.fn();
    render(<PlayerTransportControls {...makeProps({ handlePlayPause })} />);

    const playBtn = screen.getByRole('button', { name: loc.player.play });
    const mediaZone = playBtn.parentElement;
    const rootGrid = mediaZone?.parentElement;

    expect(mediaZone).not.toBeNull();
    expect(rootGrid).not.toBeNull();
    expect(rootGrid?.className).toContain('lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
    expect(mediaZone?.className).toContain('justify-center');
    expect(mediaZone?.className).toContain('lg:justify-self-center');
    expect(mediaZone?.className).toContain('order-1');
    expect(mediaZone?.className).toContain('lg:order-2');

    // Utility tools stay in their own wrapping zone rather than sharing the media button group
    const lyricsBtn = screen.getByRole('button', { name: loc.player.lyrics });
    expect(lyricsBtn.parentElement).not.toBe(mediaZone);

    fireEvent.click(playBtn);
    expect(handlePlayPause).toHaveBeenCalledTimes(1);
  });
});

describe('PlayerTransportControls bookmark control', () => {
  const loc = getTranslations('en');
  const point = { id: 1, track_id: 1, name: 'P', position_ms: 1000, created_at: 0 };

  it('saves a bookmark on click and opens the points menu from the options button', () => {
    const handleSaveBookmark = vi.fn();
    const setIsBookmarksModalOpen = vi.fn();
    render(<PlayerTransportControls {...makeProps({ handleSaveBookmark, setIsBookmarksModalOpen })} />);

    fireEvent.click(screen.getByTitle(loc.player.bookmarkDesc));
    expect(handleSaveBookmark).toHaveBeenCalledTimes(1);
    expect(setIsBookmarksModalOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: loc.player.bookmarkOptions }));
    expect(setIsBookmarksModalOpen).toHaveBeenCalledWith(true);
  });

  it('opens the points menu on right-click of the bookmark button', () => {
    const setIsBookmarksModalOpen = vi.fn();
    render(<PlayerTransportControls {...makeProps({ setIsBookmarksModalOpen })} />);
    fireEvent.contextMenu(screen.getByTitle(loc.player.bookmarkDesc));
    expect(setIsBookmarksModalOpen).toHaveBeenCalledWith(true);
  });

  it('colours the options button and shows a count only once the track has points', () => {
    const { rerender } = render(<PlayerTransportControls {...makeProps()} />);
    const plain = screen.getByRole('button', { name: loc.player.bookmarkOptions });
    const plainClass = plain.className;
    expect(plain.textContent).toBe('');

    rerender(<PlayerTransportControls {...makeProps({ currentTrackBookmarks: [point, { ...point, id: 2 }] })} />);
    const tinted = screen.getByTitle(loc.player.bookmarksModalTitle.replace('{0}', '2'));
    expect(tinted.textContent).toBe('2');
    expect(tinted.className).not.toBe(plainClass);
  });

  it('does not open the menu without a loaded track', () => {
    const setIsBookmarksModalOpen = vi.fn();
    const showMessage = vi.fn();
    render(<PlayerTransportControls {...makeProps({ activeTrackId: null, setIsBookmarksModalOpen, showMessage })} />);
    fireEvent.click(screen.getByRole('button', { name: loc.player.bookmarkOptions }));
    expect(setIsBookmarksModalOpen).not.toHaveBeenCalled();
    expect(showMessage).toHaveBeenCalledWith(loc.player.loadTrackToManageBookmarks, true);
  });
});
