// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolveActiveRadioStation } from './radioStation';

const station = { name: 'Anime FM', url: 'http://stream.radio.fm/live', genre: 'J-Pop' };

describe('resolveActiveRadioStation', () => {
  it('returns null when no station is stored', () => {
    expect(resolveActiveRadioStation(null, 'http://x')).toBeNull();
  });

  it('keeps the station while a stream is playing', () => {
    expect(resolveActiveRadioStation(station, 'http://stream.radio.fm/live')).toBe(station);
    expect(resolveActiveRadioStation(station, 'https://other.example/stream')).toBe(station);
  });

  it('keeps the station before the engine reports a track (just started)', () => {
    expect(resolveActiveRadioStation(station, undefined)).toBe(station);
    expect(resolveActiveRadioStation(station, null)).toBe(station);
  });

  it('drops the stale station once a local file or stem project plays', () => {
    expect(resolveActiveRadioStation(station, '/music/song.flac')).toBeNull();
    expect(resolveActiveRadioStation(station, 'file:///music/song.flac')).toBeNull();
  });
});
