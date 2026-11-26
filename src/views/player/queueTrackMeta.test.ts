import { describe, it, expect } from 'vitest';
import { resolveQueueTrackMeta } from './queueTrackMeta';
import type { AlbumRecord, TrackRecord } from '../../types/player';
import type { QueueItem } from '../../types/queue';

const album: AlbumRecord = { id: 3, title: 'Kimi no Na wa', album_artist: 'RADWIMPS', year: 2016, cover_path: '/c.jpg' };
const track = { id: 7, path: '/m/zen.flac', title: 'Zenzenzense', artist: 'RADWIMPS', album_artist: 'RADWIMPS',
  album_id: 3, duration_ms: 1, format: 'FLAC', sample_rate: 96000, channels: 2, bit_depth: 24,
  file_size: 1, modified_time: 1, disc_no: null, track_no: null } as TrackRecord;
const item = (over: Partial<QueueItem>): QueueItem =>
  ({ id: 'q', track_id: null, uri: '/x/song.mp3', title: 'S', artist: 'A', album: null, duration_ms: 1, ...over }) as QueueItem;

describe('resolveQueueTrackMeta', () => {
  it('matches by track id and takes album cover and quality from the library', () => {
    const meta = resolveQueueTrackMeta(item({ track_id: 7 }), [track], [album]);
    expect(meta).toMatchObject({ track, album, cover: '/c.jpg', format: 'FLAC', sampleRate: 96000, bitDepth: 24 });
  });

  it('matches by path when the item has no track id', () => {
    expect(resolveQueueTrackMeta(item({ uri: '/m/zen.flac' }), [track], [album]).track).toBe(track);
  });

  it('falls back to album title (case/whitespace-insensitive) and the file extension', () => {
    const meta = resolveQueueTrackMeta(item({ album: '  kimi NO na WA ' }), [], [album]);
    expect(meta.album).toBe(album);
    expect(meta.format).toBe('MP3');
    expect(meta.track).toBeUndefined();
  });

  it('uses AUDIO when nothing is known', () => {
    const meta = resolveQueueTrackMeta(item({ uri: '' }), [], []);
    expect(meta).toMatchObject({ album: null, cover: null, format: 'AUDIO' });
  });
});
