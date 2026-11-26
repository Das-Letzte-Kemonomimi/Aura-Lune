export interface TrackRecord {
  id: number;
  path: string;
  title: string;
  artist: string;
  album_artist: string | null;
  album_id: number | null;
  disc_no: number | null;
  track_no: number | null;
  duration_ms: number;
  format: string;
  sample_rate: number;
  channels: number;
  bit_depth: number | null;
  file_size: number;
  modified_time: number;
  is_favorite?: boolean | null;
  play_count?: number | null;
  last_played_at?: number | null;
  total_play_time_ms?: number | null;
  replaygain_track_gain?: number | null;
  replaygain_track_peak?: number | null;
  rating?: number | null;
  bpm?: number | null;
  initial_key?: string | null;
}

export interface AlbumRecord {
  id: number;
  title: string;
  album_artist: string;
  year: number | null;
  cover_path: string | null;
  release_mbid?: string | null;
}

export interface ScanSummaryDto {
  total_files_found: number;
  new_or_updated_tracks: number;
  skipped_unchanged: number;
  errors: number;
}

export interface SampleTrackDto {
  path: string;
  title: string;
  artist: string;
  album: string | null;
  duration_ms: number;
  genre: string | null;
}

export interface ReleaseCandidateDto {
  mbid: string;
  title: string;
  artist: string;
  date: string | null;
  country: string | null;
  track_count: number | null;
  score: number;
}
