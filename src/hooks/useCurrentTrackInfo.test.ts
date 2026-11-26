import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCurrentTrackInfo } from './useCurrentTrackInfo';
import type { TrackRecord, AlbumRecord, PlaybackStatus } from '../types/player';
import { getTranslations } from '../i18n';
import { invokeMock } from '../test/ipcMock';

beforeEach(() => {
  invokeMock.mockResolvedValue(null);
});


describe('useCurrentTrackInfo', () => {
  const loc = getTranslations('en');

  const mockTrack1: TrackRecord = {
    id: 1,
    title: 'Test Song One',
    artist: 'Test Artist',
    album_artist: 'Test Artist',
    album_id: 10,
    path: '/music/test1.flac',
    duration_ms: 200000,
    format: 'flac',
    sample_rate: 44100,
    channels: 2,
    disc_no: 1,
    track_no: 1,
    bit_depth: 16,
    file_size: 10240,
    modified_time: 1234567,
    initial_key: '8B',
    bpm: 120,
  };

  const mockTrack2: TrackRecord = {
    id: 2,
    title: 'Test Song Two',
    artist: 'Second Artist',
    album_artist: 'Second Artist',
    album_id: 20,
    path: '/music/test2.flac',
    duration_ms: 180000,
    format: 'flac',
    sample_rate: 48000,
    channels: 2,
    disc_no: 1,
    track_no: 2,
    bit_depth: 24,
    file_size: 20480,
    modified_time: 1234568,
    initial_key: null,
    bpm: null,
  };

  const mockAlbum1: AlbumRecord = {
    id: 10,
    title: 'Test Album One',
    album_artist: 'Test Artist',
    year: 2024,
    cover_path: null,
  };

  const baseStatus: PlaybackStatus = {
    state: 'Playing',
    position_ms: 50000,
    duration_ms: 200000,
    volume: 1.0,
    engine: 'SoundTouch',
    capabilities: {
      engine: 'SoundTouch',
      name: 'SoundTouch',
      min_pitch_semitones: -12,
      max_pitch_semitones: 12,
      min_tempo_ratio: 0.5,
      max_tempo_ratio: 2.0,
      supports_formants: false,
      description: 'SoundTouch DSP',
    },
    pitch_semitones: 0,
    tempo_ratio: 1.0,
    rate_ratio: 1.0,
    current_track: {
      id: 'item-1',
      track_id: 1,
      uri: '/music/test1.flac',
      title: 'Test Song One',
      artist: 'Test Artist',
      album: 'Test Album One',
      duration_ms: 200000,
    },
  };

  it('matches track and album from status', () => {
    const { result } = renderHook(() =>
      useCurrentTrackInfo({
        tracks: [mockTrack1, mockTrack2],
        albums: [mockAlbum1],
        status: baseStatus,
        filePath: '',
        activeTrackId: null,
        trackDirectCover: null,
        setTrackDirectCover: vi.fn(),
        loc,
      })
    );

    expect(result.current.currentPlayingTrack?.id).toBe(1);
    expect(result.current.currentAlbum?.id).toBe(10);
    expect(result.current.effectiveDisplayTitle).toBe('Test Song One');
    expect(result.current.effectiveDisplayArtist).toBe('Test Artist');
    expect(result.current.isPlayingRadio).toBe(false);
  });

  it('matches track by activeTrackId or filePath fallback when status track is empty', () => {
    const emptyStatus: PlaybackStatus = {
      ...baseStatus,
      current_track: undefined,
    };

    const { result } = renderHook(() =>
      useCurrentTrackInfo({
        tracks: [mockTrack1, mockTrack2],
        albums: [mockAlbum1],
        status: emptyStatus,
        filePath: '/music/test2.flac',
        activeTrackId: 2,
        trackDirectCover: null,
        setTrackDirectCover: vi.fn(),
        loc,
      })
    );

    expect(result.current.currentPlayingTrack?.id).toBe(2);
    expect(result.current.effectiveDisplayTitle).toBe('Test Song Two');
    expect(result.current.effectiveDisplayArtist).toBe('Second Artist');
  });

  it('computes DSP combination and badge text for Bypass and active modes', () => {
    const bypassStatus: PlaybackStatus = {
      ...baseStatus,
      engine: 'Bypass',
    };

    const { result: bypassResult } = renderHook(() =>
      useCurrentTrackInfo({
        tracks: [mockTrack1],
        albums: [mockAlbum1],
        status: bypassStatus,
        filePath: '',
        activeTrackId: 1,
        trackDirectCover: null,
        setTrackDirectCover: vi.fn(),
        loc,
      })
    );

    expect(bypassResult.current.dspBadgeText).toBe('Bypass');

    const activeDspStatus: PlaybackStatus = {
      ...baseStatus,
      engine: 'SoundTouch',
      tempo_ratio: 1.25,
      pitch_semitones: 2.0,
    };

    const { result: activeResult } = renderHook(() =>
      useCurrentTrackInfo({
        tracks: [mockTrack1],
        albums: [mockAlbum1],
        status: activeDspStatus,
        filePath: '',
        activeTrackId: 1,
        trackDirectCover: null,
        setTrackDirectCover: vi.fn(),
        loc,
      })
    );

    expect(activeResult.current.dspCombination.hasTempo).toBe(true);
    expect(activeResult.current.dspCombination.hasPitch).toBe(true);
    expect(activeResult.current.dspBadgeText).toContain('SoundTouch');
    expect(activeResult.current.dspBadgeText).toContain('1.25x');
    expect(activeResult.current.dspBadgeText).toContain('+2.00st');
  });

  it('handles radio station title, artist, and isPlayingRadio correctly', () => {
    const radioStatus: PlaybackStatus = {
      ...baseStatus,
      current_track: undefined,
      live_stream_title: 'DJ Anime - Epic Remix',
    };

    const { result } = renderHook(() =>
      useCurrentTrackInfo({
        tracks: [],
        albums: [],
        status: radioStatus,
        filePath: 'http://stream.radio.fm/live',
        activeTrackId: null,
        trackDirectCover: null,
        setTrackDirectCover: vi.fn(),
        currentRadioStation: {
          name: 'Anime FM',
          url: 'http://stream.radio.fm/live',
          genre: 'J-Pop',
        },
        loc,
      })
    );

    expect(result.current.isPlayingRadio).toBe(true);
    expect(result.current.effectiveDisplayTitle).toBe('DJ Anime - Epic Remix');
    expect(result.current.effectiveDisplayArtist).toBe('Anime FM');
  });

  it('generates consistent track waveform peaks of length 160 within [16, 100]', () => {
    const { result } = renderHook(() =>
      useCurrentTrackInfo({
        tracks: [mockTrack1],
        albums: [mockAlbum1],
        status: baseStatus,
        filePath: '',
        activeTrackId: 1,
        trackDirectCover: null,
        setTrackDirectCover: vi.fn(),
        loc,
      })
    );

    expect(result.current.trackWaveformPeaks).toHaveLength(160);
    result.current.trackWaveformPeaks.forEach((val) => {
      expect(val).toBeGreaterThanOrEqual(16);
      expect(val).toBeLessThanOrEqual(100);
    });
  });

  it('clears stale trackDirectCover when switching to a track with no embedded cover', async () => {
    invokeMock.mockResolvedValue(null);
    const setTrackDirectCover = vi.fn();
    renderHook(() =>
      useCurrentTrackInfo({
        tracks: [mockTrack2],
        albums: [],
        status: {
          ...baseStatus,
          current_track: {
            id: 'item-2',
            track_id: 2,
            uri: mockTrack2.path,
            title: mockTrack2.title,
            artist: mockTrack2.artist,
            album: null,
            duration_ms: mockTrack2.duration_ms,
          },
        },
        filePath: mockTrack2.path,
        activeTrackId: 2,
        trackDirectCover: 'data:image/jpeg;base64,OLD_COVER',
        setTrackDirectCover,
        loc,
      })
    );

    await waitFor(() => {
      expect(setTrackDirectCover).toHaveBeenCalledWith(null);
    });
  });

  it('does not fall back to a different artist album sharing the same album title', () => {
    const albumA: AlbumRecord = {
      id: 101,
      title: 'Adagio',
      album_artist: 'Artist A',
      year: 2007,
      cover_path: 'data:image/jpeg;base64,ARTIST_A_COVER',
    };
    const otherStatus: PlaybackStatus = {
      ...baseStatus,
      current_track: {
        id: 'dropped-adagio',
        track_id: null,
        uri: '/tmp/other_adagio.flac',
        title: 'Track',
        artist: 'Artist B',
        album: 'Adagio',
        duration_ms: 180000,
      },
    };
    const { result } = renderHook(() =>
      useCurrentTrackInfo({
        tracks: [],
        albums: [albumA],
        status: otherStatus,
        filePath: '/tmp/other_adagio.flac',
        activeTrackId: null,
        trackDirectCover: null,
        setTrackDirectCover: vi.fn(),
        loc,
      })
    );

    expect(result.current.currentAlbum).toBeNull();
    expect(result.current.currentCover).toBeNull();
  });
});
