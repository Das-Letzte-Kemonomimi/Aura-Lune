import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaylistManager } from './usePlaylistManager';
import { getTranslations } from '../i18n';

describe('usePlaylistManager', () => {
  const loc = getTranslations('en');

  const defaultProps = {
    language: 'en' as const,
    loc,
    t: loc,
    showMessage: vi.fn(),
  };

  it('initializes with default state', () => {
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    expect(result.current.playlists).toEqual([]);
    expect(result.current.selectedPlaylist).toBeNull();
    expect(result.current.playlistTracks).toEqual([]);
    expect(result.current.newPlaylistName).toBe('');
    expect(result.current.showPlaylistModal).toBe(false);
  });

  it('updates new playlist name', () => {
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    act(() => {
      result.current.setNewPlaylistName('Favorites 2026');
    });

    expect(result.current.newPlaylistName).toBe('Favorites 2026');
  });

  it('saves custom radio station into state', () => {
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    act(() => {
      result.current.handleSaveCustomStation({
        name: 'Chillhop Cafe',
        url: 'https://stream.chillhop.com/live',
        genre: 'Lofi',
      });
    });

    expect(result.current.customRadioStations.length).toBeGreaterThan(0);
    expect(result.current.customRadioStations[0].name).toBe('Chillhop Cafe');
  });
});
