// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PlayerTrackHeader, type PlayerTrackHeaderProps } from './PlayerTrackHeader';
import { getTranslations } from '../../../i18n';
import { DEFAULT_PLAYBACK_STATUS, type AlbumRecord } from '../../../types/player';

const sampleAlbum: AlbumRecord = {
  id: 42,
  title: 'Vollmond über Frankfurt',
  album_artist: 'In Extremo',
  year: 2006,
  cover_path: null,
  release_mbid: null,
};

function makeProps(overrides: Partial<PlayerTrackHeaderProps> = {}): PlayerTrackHeaderProps {
  return {
    loc: getTranslations('en'),
    status: {
      ...DEFAULT_PLAYBACK_STATUS,
      state: 'Playing',
      current_track: {
        id: 'q1',
        track_id: 1,
        title: 'Die Gier',
        artist: 'In Extremo',
        album: 'Vollmond über Frankfurt',
        uri: '/music/die-gier.flac',
        duration_ms: 210000,
      },
    },
    currentAlbum: sampleAlbum,
    currentPlayingTrack: null,
    cleanLiveTitle: null,
    effectiveDisplayTitle: 'Die Gier',
    effectiveDisplayArtist: 'In Extremo',
    filePath: '/music/die-gier.flac',
    setStatsModalTrack: vi.fn(),
    handleToggleFavorite: vi.fn(),
    handleOpenContainingFolder: vi.fn(),
    handleOpenAlbumInLibrary: vi.fn(),
    ...overrides,
  };
}

describe('PlayerTrackHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('redirects to the library album view when clicking the album name', () => {
    const handleOpenAlbumInLibrary = vi.fn();
    render(<PlayerTrackHeader {...makeProps({ handleOpenAlbumInLibrary })} />);

    const albumButton = screen.getByRole('button', { name: 'Vollmond über Frankfurt' });
    fireEvent.click(albumButton);

    expect(handleOpenAlbumInLibrary).toHaveBeenCalledTimes(1);
    expect(handleOpenAlbumInLibrary).toHaveBeenCalledWith(sampleAlbum);
  });

  it('renders album name as plain text when currentAlbum is not in the library', () => {
    render(<PlayerTrackHeader {...makeProps({ currentAlbum: null })} />);

    expect(screen.getByText('Vollmond über Frankfurt')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Vollmond über Frankfurt' })).toBeNull();
  });
});
