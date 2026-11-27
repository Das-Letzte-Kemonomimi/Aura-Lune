import { describe, expect, it } from 'vitest';
import { FORGOTTEN_MIN_AGE_SECONDS, FORGOTTEN_MIN_PLAYS, forgottenGemScore, formatAddedDate, isForgottenGem, isHiRes, trackComparator } from './trackModel';
import type { TrackRecord } from '../../../types/library';

describe('isHiRes', () => {
  it('accepts 24-bit files at CD sample rate', () => {
    expect(isHiRes({ bit_depth: 24, sample_rate: 44100 })).toBe(true);
  });

  it('accepts 88.2 kHz and up without a bit depth', () => {
    expect(isHiRes({ bit_depth: null, sample_rate: 88200 })).toBe(true);
  });

  it('rejects 16-bit 48 kHz and lossy files without a bit depth', () => {
    expect(isHiRes({ bit_depth: 16, sample_rate: 48000 })).toBe(false);
    expect(isHiRes({ bit_depth: null, sample_rate: 44100 })).toBe(false);
  });
});

describe('trackComparator', () => {
  const base = { artist: 'A', album_artist: null, album_id: null, disc_no: null, track_no: null, duration_ms: 1, format: 'FLAC', sample_rate: 44100, channels: 2, bit_depth: 16, file_size: 1, modified_time: 1, path: '' };
  const mk = (id: number, extra: Partial<TrackRecord>): TrackRecord => ({ ...base, id, title: `T${id}`, ...extra });

  it('sorts by year via the album, with unknown years last in both directions', () => {
    const years = new Map([[1, 2001], [2, 1995]]);
    const list = [mk(1, { album_id: 1 }), mk(2, { album_id: 2 }), mk(3, {})];
    expect([...list].sort(trackComparator('year', 'asc', years)).map((t) => t.id)).toEqual([2, 1, 3]);
    expect([...list].sort(trackComparator('year', 'desc', years)).map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it('sorts by date added and treats a missing value as oldest', () => {
    const list = [mk(1, { added_at: 300 }), mk(2, {}), mk(3, { added_at: 100 })];
    expect([...list].sort(trackComparator('added', 'desc', new Map())).map((t) => t.id)).toEqual([1, 3, 2]);
  });
});

describe('formatAddedDate', () => {
  it('formats unix seconds as a date with the year', () => {
    expect(formatAddedDate(1_700_000_000, 'en-US')).toContain('2023');
  });

  it('is empty when the date is unknown', () => {
    expect(formatAddedDate(null)).toBe('');
    expect(formatAddedDate(0)).toBe('');
  });
});

describe('Forgotten Gems', () => {
  const now = 1_750_000_000;

  it('requires at least 3 plays and 30 days since last play (or unknown timestamp)', () => {
    expect(isForgottenGem({ play_count: 0, last_played_at: null }, now)).toBe(false);
    expect(isForgottenGem({ play_count: FORGOTTEN_MIN_PLAYS - 1, last_played_at: now - FORGOTTEN_MIN_AGE_SECONDS - 10 }, now)).toBe(false);
    expect(isForgottenGem({ play_count: FORGOTTEN_MIN_PLAYS, last_played_at: now - FORGOTTEN_MIN_AGE_SECONDS + 60 }, now)).toBe(false);
    expect(isForgottenGem({ play_count: FORGOTTEN_MIN_PLAYS, last_played_at: now - FORGOTTEN_MIN_AGE_SECONDS }, now)).toBe(true);
    expect(isForgottenGem({ play_count: FORGOTTEN_MIN_PLAYS, last_played_at: null }, now)).toBe(true);
  });

  it('scores higher-engagement and older tracks above recent low-play tracks', () => {
    const recentLow = forgottenGemScore({ play_count: 3, last_played_at: now - 31 * 86400, is_favorite: false, rating: 0 }, now);
    const oldFavorite = forgottenGemScore({ play_count: 20, last_played_at: now - 120 * 86400, is_favorite: true, rating: 5 }, now);
    expect(oldFavorite).toBeGreaterThan(recentLow);
  });
});
