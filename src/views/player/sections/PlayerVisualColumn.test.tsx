import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlayerVisualColumn, type PlayerVisualColumnProps } from './PlayerVisualColumn';
import { DEFAULT_PLAYBACK_STATUS } from '../../../types/player';
import { getTranslations } from '../../../i18n';
import { installCanvasMock } from '../../../test/canvasMock';

afterEach(cleanup);

function makeProps(overrides: Partial<PlayerVisualColumnProps> = {}): PlayerVisualColumnProps {
  return {
    nowPlayingVisualMode: 'cover',
    handleSelectNowPlayingVisualMode: vi.fn(),
    loc: getTranslations('en'),
    language: 'en',
    currentCover: null,
    currentPlayingTrack: null,
    tracks: [],
    handlePlayPause: vi.fn(),
    vinylRpm: 33,
    handleSelectVinylRpm: vi.fn(),
    setIsLoFiModalOpen: vi.fn(),
    tapeType: 'TYPE_II',
    handleSelectTapeType: vi.fn(),
    tapeSpeed: '7.5',
    handleSelectTapeSpeed: vi.fn(),
    currentAlbum: null,
    handleOpenCoverPicker: vi.fn(),
    albums: [],
    handleUploadCustomCoverDirect: vi.fn(),
    dspBadgeTitle: 'Direct Bypass',
    dspBadgeText: 'Bypass',
    status: {
      ...DEFAULT_PLAYBACK_STATUS,
      state: 'Playing',
      current_track: {
        id: 'q-1',
        track_id: 1,
        uri: '/music/rain.flac',
        title: 'Rain and Cappuccino',
        artist: 'Yorushika',
        album: 'Elma',
        duration_ms: 240_000,
      },
    },
    ...overrides,
  };
}

describe('PlayerVisualColumn', () => {
  beforeEach(() => {
    installCanvasMock();
  });

  it('keeps the cover action buttons bounded and wrappable inside a 2-column grid', () => {
    const handleOpenCoverPicker = vi.fn();
    const handleUploadCustomCoverDirect = vi.fn();
    render(<PlayerVisualColumn {...makeProps({ handleOpenCoverPicker, handleUploadCustomCoverDirect })} />);

    const matchBtn = screen.getByRole('button', { name: 'Match Cover' });
    const uploadBtn = screen.getByRole('button', { name: 'Upload Custom Cover' });
    const row = matchBtn.parentElement;

    expect(row).not.toBeNull();
    expect(row?.className).toContain('grid-cols-2');
    expect(row?.className).toContain('max-w-66');
    expect(matchBtn.className).toContain('min-w-0');
    expect(matchBtn.className).toContain('whitespace-normal');
    expect(uploadBtn.className).toContain('min-w-0');
    expect(uploadBtn.className).toContain('whitespace-normal');

    fireEvent.click(matchBtn);
    expect(handleOpenCoverPicker).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Elma', album_artist: 'Yorushika' }),
    );

    fireEvent.click(uploadBtn);
    expect(handleUploadCustomCoverDirect).toHaveBeenCalledWith(null);
  });

  it('keeps the mode selector at one consistent max width across all visual modes', () => {
    const props = makeProps({ nowPlayingVisualMode: 'cover' });
    const { rerender } = render(<PlayerVisualColumn {...props} />);
    const coverTablistWidth = screen.getByRole('tablist').className;

    for (const mode of ['turntable', 'tape', 'vumeter'] as const) {
      rerender(<PlayerVisualColumn {...makeProps({ nowPlayingVisualMode: mode })} />);
      expect(screen.getByRole('tablist').className).toBe(coverTablistWidth);
      expect(screen.getByRole('tablist').className).toContain('max-w-69');
      expect(screen.getByRole('tablist').className).not.toContain('max-w-60');
    }
  });
});
