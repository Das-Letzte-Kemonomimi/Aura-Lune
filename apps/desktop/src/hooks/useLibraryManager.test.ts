import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useLibraryManager } from './useLibraryManager';
import { getTranslations } from '../i18n';
import type { PlaybackStatus } from '../types/playback';
import type { TrackRecord, AlbumRecord } from '../types/library';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('useLibraryManager hook', () => {
  const loc = getTranslations('en');
  const showMessage = vi.fn();

  const mockStatus: PlaybackStatus = {
    state: 'Stopped',
    position_ms: 0,
    duration_ms: null,
    volume: 1.0,
    pitch_semitones: 0,
    tempo_ratio: 1,
    rate_ratio: 1,
    engine: 'Bypass',
    capabilities: {
      engine: 'Bypass',
      name: 'Direct',
      min_pitch_semitones: -24,
      max_pitch_semitones: 24,
      min_tempo_ratio: 0.15,
      max_tempo_ratio: 4,
      supports_formants: false,
      description: 'Bit-perfect direct stream without DSP',
    },
    equalizer_enabled: false,
    equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    current_track: null,
  };

  const setStatus = vi.fn();
  const setFilePath = vi.fn();
  const setActiveTrackId = vi.fn();
  const mainContentRef = React.createRef<HTMLElement>();

  const defaultProps = {
    mainContentRef,
    status: mockStatus,
    setStatus,
    setFilePath,
    setActiveTrackId,
    showMessage,
    loc,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockInvoke.mockResolvedValue(null);
  });

  it('initializes with empty tracks and albums', () => {
    const { result } = renderHook(() => useLibraryManager(defaultProps));

    expect(result.current.tracks).toEqual([]);
    expect(result.current.albums).toEqual([]);
    expect(result.current.librarySubView).toBe('tracks');
    expect(result.current.librarySearch).toBe('');
    expect(result.current.sortField).toBe('default');
    expect(result.current.sortOrder).toBe('asc');
  });

  it('loads library tracks and albums successfully', async () => {
    const mockTracks: TrackRecord[] = [
      {
        id: 1,
        title: 'Song A',
        artist: 'Artist X',
        album_artist: 'Artist X',
        album_id: 10,
        disc_no: 1,
        track_no: 1,
        path: '/music/song_a.flac',
        duration_ms: 180000,
        format: 'flac',
        sample_rate: 44100,
        bit_depth: 16,
        channels: 2,
        file_size: 1000000,
        bpm: 120,
        initial_key: '8B',
        replaygain_track_gain: 0,
        replaygain_track_peak: 1.0,
        is_favorite: false,
        rating: 5,
        play_count: 3,
        last_played_at: null,
        modified_time: 1000,
      },
    ];

    const mockAlbums: AlbumRecord[] = [
      {
        id: 10,
        title: 'Album 1',
        album_artist: 'Artist X',
        year: 2024,
        cover_path: '/covers/10.jpg',
        release_mbid: null,
      },
    ];

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_library_tracks') return mockTracks;
      if (cmd === 'get_library_albums') return mockAlbums;
      return null;
    });

    const { result } = renderHook(() => useLibraryManager(defaultProps));

    await act(async () => {
      await result.current.loadLibrary();
    });

    expect(result.current.tracks).toEqual(mockTracks);
    expect(result.current.albums).toEqual(mockAlbums);
    expect(result.current.filteredTracks).toHaveLength(1);
    expect(result.current.albumsWithCoverCount).toBe(1);
    expect(result.current.albumsWithoutCoverCount).toBe(0);
  });

  it('filters tracks by search query and formats', () => {
    const { result } = renderHook(() => useLibraryManager(defaultProps));

    const sampleTracks: TrackRecord[] = [
      {
        id: 1,
        title: 'Neon Light',
        artist: 'CyberBand',
        album_artist: 'CyberBand',
        album_id: null,
        disc_no: 1,
        track_no: 1,
        path: '/music/neon.flac',
        duration_ms: 200000,
        format: 'flac',
        sample_rate: 44100,
        bit_depth: 16,
        channels: 2,
        file_size: 2000000,
        bpm: 128,
        initial_key: '5A',
        replaygain_track_gain: 0,
        replaygain_track_peak: 1.0,
        is_favorite: true,
        rating: 5,
        play_count: 10,
        last_played_at: 12345,
        modified_time: 2000,
      },
      {
        id: 2,
        title: 'Quiet Echoes',
        artist: 'Acoustic Solo',
        album_artist: 'Acoustic Solo',
        album_id: null,
        disc_no: 1,
        track_no: 2,
        path: '/music/quiet.mp3',
        duration_ms: 150000,
        format: 'mp3',
        sample_rate: 44100,
        bit_depth: null,
        channels: 2,
        file_size: 1500000,
        bpm: 85,
        initial_key: '3B',
        replaygain_track_gain: 0,
        replaygain_track_peak: 1.0,
        is_favorite: false,
        rating: 3,
        play_count: 0,
        last_played_at: null,
        modified_time: 1500,
      },
    ];

    act(() => {
      result.current.setTracks(sampleTracks);
    });

    expect(result.current.filteredTracks).toHaveLength(2);

    // Search query filter
    act(() => {
      result.current.setLibrarySearch('neon');
    });
    expect(result.current.filteredTracks).toHaveLength(1);
    expect(result.current.filteredTracks[0].title).toBe('Neon Light');

    // Format filter
    act(() => {
      result.current.setLibrarySearch('');
      result.current.setLibraryFormatFilter('mp3');
    });
    expect(result.current.filteredTracks).toHaveLength(1);
    expect(result.current.filteredTracks[0].title).toBe('Quiet Echoes');
  });

  it('cycles track sort order and field', () => {
    const { result } = renderHook(() => useLibraryManager(defaultProps));

    act(() => {
      result.current.handleSort('title');
    });
    expect(result.current.sortField).toBe('title');
    expect(result.current.sortOrder).toBe('asc');

    act(() => {
      result.current.handleSort('title');
    });
    expect(result.current.sortOrder).toBe('desc');
  });

  it('supports ascending and descending sort on default (#) field', () => {
    const { result } = renderHook(() => useLibraryManager(defaultProps));

    const sampleTracks: TrackRecord[] = [
      {
        id: 1,
        title: 'Alpha',
        artist: 'Band',
        album_artist: 'Band',
        album_id: null,
        disc_no: 1,
        track_no: 1,
        path: '/music/alpha.flac',
        duration_ms: 100000,
        format: 'flac',
        sample_rate: 44100,
        bit_depth: 16,
        channels: 2,
        file_size: 1000000,
        bpm: 120,
        initial_key: '5A',
        replaygain_track_gain: 0,
        replaygain_track_peak: 1.0,
        is_favorite: false,
        rating: 0,
        play_count: 0,
        last_played_at: null,
        modified_time: 1000,
      },
      {
        id: 2,
        title: 'Beta',
        artist: 'Band',
        album_artist: 'Band',
        album_id: null,
        disc_no: 1,
        track_no: 2,
        path: '/music/beta.flac',
        duration_ms: 200000,
        format: 'flac',
        sample_rate: 44100,
        bit_depth: 16,
        channels: 2,
        file_size: 2000000,
        bpm: 130,
        initial_key: '6A',
        replaygain_track_gain: 0,
        replaygain_track_peak: 1.0,
        is_favorite: false,
        rating: 0,
        play_count: 0,
        last_played_at: null,
        modified_time: 2000,
      },
    ];

    act(() => {
      result.current.setTracks(sampleTracks);
    });

    expect(result.current.sortField).toBe('default');
    expect(result.current.sortOrder).toBe('asc');
    expect(result.current.sortedTracks[0].title).toBe('Alpha');
    expect(result.current.sortedTracks[1].title).toBe('Beta');

    // Clicking '#' while already in default toggles to descending
    act(() => {
      result.current.handleSort('default');
    });
    expect(result.current.sortField).toBe('default');
    expect(result.current.sortOrder).toBe('desc');
    expect(result.current.sortedTracks[0].title).toBe('Beta');
    expect(result.current.sortedTracks[1].title).toBe('Alpha');

    // Clicking '#' again toggles back to ascending
    act(() => {
      result.current.handleSort('default');
    });
    expect(result.current.sortField).toBe('default');
    expect(result.current.sortOrder).toBe('asc');
    expect(result.current.sortedTracks[0].title).toBe('Alpha');
    expect(result.current.sortedTracks[1].title).toBe('Beta');
  });
});

