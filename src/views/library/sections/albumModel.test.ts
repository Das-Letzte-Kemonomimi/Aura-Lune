import { describe, expect, it } from 'vitest';
import type { TrackRecord } from '../../../types/library';
import { buildAlbumStats, MIXED_FORMAT } from './albumModel';

const track = (over: Partial<TrackRecord>): TrackRecord =>
  ({ id: 1, title: 't', artist: 'A', album_id: 1, format: 'flac', duration_ms: 1000, sample_rate: 44100, ...over }) as TrackRecord;

describe('buildAlbumStats', () => {
  it('sums tracks, duration, plays and heard tracks per album', () => {
    const stats = buildAlbumStats([
      track({ id: 1, play_count: 3 }),
      track({ id: 2, play_count: 0, duration_ms: 2000 }),
      track({ id: 3, album_id: 2, play_count: 1 }),
    ]);
    expect(stats.get(1)).toMatchObject({ trackCount: 2, durationMs: 3000, playCount: 3, heardCount: 1, format: 'FLAC' });
    expect(stats.get(2)).toMatchObject({ trackCount: 1, playCount: 1, heardCount: 1 });
  });

  it('reports mixed formats', () => {
    const stats = buildAlbumStats([track({ id: 1, format: 'flac' }), track({ id: 2, format: 'mp3' })]);
    expect(stats.get(1)?.format).toBe(MIXED_FORMAT);
  });

  it('flags hi-res when any track is hi-res', () => {
    const stats = buildAlbumStats([track({ id: 1 }), track({ id: 2, bit_depth: 24 })]);
    expect(stats.get(1)?.hiRes).toBe(true);
    expect(buildAlbumStats([track({ id: 3 })]).get(1)?.hiRes).toBe(false);
  });

  it('treats an unheard album and a missing play count as zero', () => {
    const stats = buildAlbumStats([track({ id: 1, play_count: undefined }), track({ id: 2 })]);
    expect(stats.get(1)).toMatchObject({ playCount: 0, heardCount: 0 });
  });

  it('ignores tracks without an album', () => {
    expect(buildAlbumStats([track({ album_id: null })]).size).toBe(0);
  });
});
