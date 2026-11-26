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
  /** Unix seconds when the track first entered the library. */
  added_at?: number | null;
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

export interface CoverCandidate {
  source: string;
  title: string;
  artist: string;
  thumbnail_url: string;
  full_url: string;
  width?: number;
  height?: number;
  match_score: number;
  release_mbid?: string | null;
  release_year?: number | null;
  track_count?: number | null;
}

export interface AlbumCoverUpdatedPayload {
  album_id: number;
  cover_path: string;
  release_mbid?: string | null;
}

export interface CoverSyncProgress {
  running: boolean;
  processed: number;
  total: number;
}

export interface CoverSyncDispatchResult {
  started: boolean;
  already_running: boolean;
  progress: CoverSyncProgress;
}
