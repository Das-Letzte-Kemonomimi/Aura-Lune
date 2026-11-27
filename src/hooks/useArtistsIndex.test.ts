// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useArtistsIndex } from './useArtistsIndex';
import type { AlbumRecord, TrackRecord } from '../types/library';

const makeTrack = (overrides: Partial<TrackRecord>): TrackRecord => ({
  id: 1,
  title: 'Track',
  artist: 'Artist',
  album_artist: 'Artist',
  album_id: 10,
  disc_no: 1,
  track_no: 1,
  path: '/music/track.flac',
  duration_ms: 120_000,
  format: 'FLAC',
  sample_rate: 44100,
  bit_depth: 16,
  channels: 2,
  file_size: 1024,
  modified_time: 1000,
  ...overrides,
});

const albums: AlbumRecord[] = [
  { id: 10, title: 'Album A', album_artist: 'Beta', year: 2020, cover_path: 'cover-10.jpg' },
  { id: 20, title: 'Album B', album_artist: 'Alpha', year: 2021, cover_path: null },
];

const tracks: TrackRecord[] = [
  makeTrack({ id: 1, artist: 'Beta', album_id: 10, play_count: 2 }),
  makeTrack({ id: 2, artist: 'Alpha', album_id: 20, duration_ms: 60_000, play_count: 5 }),
  makeTrack({ id: 3, artist: '', album_id: null, duration_ms: 30_000 }),
];

describe('useArtistsIndex', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns empty array without grouping when disabled', () => {
    const { result } = renderHook(() =>
      useArtistsIndex({ tracks, albums, search: '', unknownArtist: 'Unknown', enabled: false }),
    );
    expect(result.current).toEqual([]);
  });

  it('groups tracks by artist with album covers and filters by search when enabled', () => {
    const { result, rerender } = renderHook(
      ({ search, enabled }: { search: string; enabled: boolean }) =>
        useArtistsIndex({ tracks, albums, search, unknownArtist: 'Unknown', enabled }),
      { initialProps: { search: '', enabled: true } },
    );

    expect(result.current.map((a) => a.name)).toEqual(['Alpha', 'Beta', 'Unknown']);
    expect(result.current[1].sampleCover).toBe('cover-10.jpg');
    expect(result.current[0].totalPlays).toBe(5);

    rerender({ search: 'bet', enabled: true });
    expect(result.current.map((a) => a.name)).toEqual(['Beta']);
  });
});
