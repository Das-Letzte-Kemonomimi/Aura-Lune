import { describe, expect, it } from 'vitest';
import type { TrackRecord } from '../../types/library';
import { computeLibraryStats, countForm } from './statsModel';

const track = (over: Partial<TrackRecord>): TrackRecord =>
  ({ id: 1, title: 't', artist: 'A', format: 'flac', duration_ms: 1000, sample_rate: 44100, ...over }) as TrackRecord;

describe('countForm', () => {
  it('follows the Polish one/few/many rule', () => {
    expect(countForm(1)).toBe('one');
    expect([2, 3, 4, 22, 34, 102].map(countForm)).toEqual(Array(6).fill('few'));
    expect([0, 5, 11, 12, 13, 14, 25, 112].map(countForm)).toEqual(Array(8).fill('many'));
  });
});

describe('computeLibraryStats', () => {
  it('sums plays, ranks artists and splits formats', () => {
    const stats = computeLibraryStats(
      [
        track({ id: 1, artist: 'A', play_count: 2, format: 'flac', bit_depth: 24 }),
        track({ id: 2, artist: 'B', play_count: 5, format: 'mp3' }),
        track({ id: 3, artist: '', play_count: 0, format: 'flac', last_played_at: 10 }),
      ],
      [],
      'Unknown',
    );
    expect(stats.totalPlays).toBe(7);
    expect(stats.totalListenedMs).toBe(7000);
    expect(stats.totalArtists).toBe(2);
    expect(stats.topTracks.map((t) => t.id)).toEqual([2, 1]);
    expect(stats.topArtists.map((a) => a.artist)).toEqual(['B', 'A']);
    expect(stats.formatBreakdown).toEqual([
      { format: 'FLAC', count: 2, percent: 67 },
      { format: 'MP3', count: 1, percent: 33 },
    ]);
    expect(stats.hiResCount).toBe(1);
    expect(stats.recentTracks.map((t) => t.id)).toEqual([3]);
  });
});
