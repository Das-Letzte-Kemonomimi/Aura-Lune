import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaylistManager } from './usePlaylistManager';
import { getTranslations } from '../i18n';
import { invokeMock } from '../test/ipcMock';
import type { Playlist } from '../types/playlist';
import type { TrackRecord } from '../types/player';

describe('usePlaylistManager', () => {
  const loc = getTranslations('en');

  const defaultProps = {
    language: 'en' as const,
    loc,
    t: loc,
    showMessage: vi.fn(),
  };

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue([]);
  });

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

  it('tracks isPlaylistTracksLoading and ignores stale responses on rapid playlist switch', async () => {
    let resolveFirst!: (tracks: TrackRecord[]) => void;
    let resolveSecond!: (tracks: TrackRecord[]) => void;

    invokeMock.mockImplementation((cmd: string, args?: { playlistId?: number }) => {
      if (cmd === 'list_playlists') return Promise.resolve([]);
      if (cmd === 'get_playlist_tracks' && args?.playlistId === 1) {
        return new Promise<TrackRecord[]>((res) => { resolveFirst = res; });
      }
      if (cmd === 'get_playlist_tracks' && args?.playlistId === 2) {
        return new Promise<TrackRecord[]>((res) => { resolveSecond = res; });
      }
      return Promise.resolve([]);
    });

    const { result } = renderHook(() => usePlaylistManager(defaultProps));
    const pl1: Playlist = { id: 1, name: 'First', track_count: 1, created_at: 1000 };
    const pl2: Playlist = { id: 2, name: 'Second', track_count: 1, created_at: 2000 };
    const track1 = { id: 10, title: 'Old Track' } as TrackRecord;
    const track2 = { id: 20, title: 'New Track' } as TrackRecord;

    act(() => {
      void result.current.handleOpenPlaylist(pl1);
    });
    expect(result.current.isPlaylistTracksLoading).toBe(true);
    expect(result.current.selectedPlaylist?.id).toBe(1);

    act(() => {
      void result.current.handleOpenPlaylist(pl2);
    });
    expect(result.current.isPlaylistTracksLoading).toBe(true);
    expect(result.current.selectedPlaylist?.id).toBe(2);

    await act(async () => {
      resolveFirst([track1]);
      await Promise.resolve();
    });
    expect(result.current.playlistTracks).toEqual([]);
    expect(result.current.isPlaylistTracksLoading).toBe(true);

    await act(async () => {
      resolveSecond([track2]);
      await Promise.resolve();
    });
    expect(result.current.playlistTracks).toEqual([track2]);
    expect(result.current.isPlaylistTracksLoading).toBe(false);
  });
});
