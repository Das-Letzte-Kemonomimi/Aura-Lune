//! Data models, SQLite records and the library and player DTOs.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("SQLite database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("Migration error: {0}")]
    Migration(String),
    #[error("Data serialisation error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error(transparent)]
    Domain(#[from] domain::DomainError),
}

/// A track record in the database.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, PartialEq)]
pub struct TrackRecord {
    pub id: i64,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album_artist: Option<String>,
    pub album_id: Option<i64>,
    pub disc_no: Option<i64>,
    pub track_no: Option<i64>,
    pub duration_ms: i64,
    pub format: String,
    pub sample_rate: i64,
    pub channels: i64,
    pub bit_depth: Option<i64>,
    pub file_size: i64,
    pub modified_time: i64,
    #[sqlx(default)]
    pub is_favorite: Option<bool>,
    #[sqlx(default)]
    pub play_count: Option<i64>,
    #[sqlx(default)]
    pub last_played_at: Option<i64>,
    #[sqlx(default)]
    pub total_play_time_ms: Option<i64>,
    #[sqlx(default)]
    pub bpm: Option<f64>,
    #[sqlx(default)]
    pub initial_key: Option<String>,
    #[sqlx(default)]
    pub replaygain_track_gain: Option<f64>,
    #[sqlx(default)]
    pub replaygain_track_peak: Option<f64>,
    #[sqlx(default)]
    pub rating: Option<i64>,
    /// Unix seconds when the track first entered the library (kept across rescans).
    #[sqlx(default)]
    #[serde(default)]
    pub added_at: Option<i64>,
}

impl TrackRecord {
    /// Builds a playback queue item from a library record.
    /// `album_title` is the album title (from the `albums` table), not the album artist.
    pub fn to_queue_item(&self, album_title: Option<String>) -> domain::queue::QueueItem {
        domain::queue::QueueItem {
            id: format!("track-{}", self.id),
            track_id: Some(self.id),
            uri: self.path.clone(),
            title: self.title.clone(),
            artist: self.artist.clone(),
            album: album_title,
            duration_ms: self.duration_ms.max(0) as u64,
        }
    }
}

/// A single track in the Recap summary.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct RecapTopTrackDto {
    pub id: i64,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub play_count: i64,
    pub total_time_ms: i64,
    pub total_play_time_ms: i64,
}

/// A single artist in the Recap summary.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct RecapTopArtistDto {
    pub artist: String,
    pub play_count: i64,
    pub total_time_ms: i64,
}

/// Listening statistics summary (Recap / Unwrapped)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct RecapSummaryDto {
    pub period: String,
    pub total_listened_ms: i64,
    pub total_listening_seconds: i64,
    pub tracks_played_count: i64,
    pub total_tracks_played: i64,
    pub top_tracks: Vec<RecapTopTrackDto>,
    pub top_artists: Vec<RecapTopArtistDto>,
}

/// A group of potential duplicates of a track in the library.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DuplicateGroup {
    pub key: String,
    pub count: usize,
    pub tracks: Vec<TrackRecord>,
}

/// An album record in the database.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, PartialEq)]
pub struct AlbumRecord {
    pub id: i64,
    pub title: String,
    pub album_artist: String,
    pub year: Option<i64>,
    pub cover_path: Option<String>,
    pub release_mbid: Option<String>,
}

/// Album metadata together with track count and sample track titles for online cover
/// disambiguation and background high-confidence matching.
///
/// Without an `ALBUMARTIST` tag the scanner splits one release into one album per track artist
/// (e.g. an anime OST with guest vocalists). The counts, samples and MBID below therefore cover the
/// album **plus its split siblings**: albums with the same title whose tracks share a folder.
#[derive(Debug, Clone, PartialEq)]
pub struct AlbumCoverLookupContext {
    pub album: AlbumRecord,
    /// Tracks of this album and of its split siblings, i.e. the size of the whole release.
    pub track_count: usize,
    /// Own tracks first, then tracks of split siblings (at most 5 in total).
    pub sample_tracks: Vec<String>,
    /// The album's own `release_mbid`, or the first one a split sibling carries.
    pub release_mbid: Option<String>,
}

/// An artist record in the database.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, PartialEq)]
pub struct ArtistRecord {
    pub id: i64,
    pub name: String,
}

/// A DSP preset record in the database.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, PartialEq)]
pub struct DspPresetRecord {
    pub id: i64,
    pub name: String,
    pub engine: String,
    pub pitch_semitones: f64,
    pub tempo_ratio: f64,
    pub rate_ratio: f64,
}

/// Input for storing a chord analysis result in the cache.
#[derive(Debug, Clone)]
pub struct NewTrackChords<'a> {
    pub track_id: i64,
    pub file_hash: &'a str,
    pub analyzer_version: &'a str,
    pub beat_grid_json: &'a str,
    pub chords_json: &'a str,
    pub bpm: Option<f64>,
    pub musical_key: Option<&'a str>,
    pub camelot: Option<&'a str>,
}

/// A cached chord analysis result.
/// The `bpm`, `musical_key` and `camelot` fields are empty for entries from before migration v2.
#[derive(Debug, Clone, FromRow, PartialEq)]
pub struct CachedTrackChords {
    pub file_hash: String,
    pub analyzer_version: String,
    pub beat_grid_json: String,
    pub chords_json: String,
    pub user_overrides_json: Option<String>,
    pub bpm: Option<f64>,
    pub musical_key: Option<String>,
    pub camelot: Option<String>,
}

/// A cached note transcription.
/// `bpm` is empty for entries from before migration v2.
#[derive(Debug, Clone, FromRow, PartialEq)]
pub struct CachedTrackTranscription {
    pub file_hash: String,
    pub analyzer_version: String,
    pub notes_json: String,
    pub bpm: Option<f64>,
}

/// A cached spectral waveform profile (`track_waveforms`).
#[derive(Debug, Clone, FromRow, PartialEq)]
pub struct CachedTrackWaveform {
    pub sample_count: i64,
    pub peaks_json: String,
    pub bands_json: String,
    pub analyzer_version: String,
    pub file_modified_time: i64,
}

/// Prepared scanned track payload for batched database persistence.
#[derive(Debug, Clone)]
pub struct ScannedTrack {
    pub record: TrackRecord,
    pub album_title: String,
    pub album_artist: String,
    pub year: Option<i64>,
    pub cover_path: Option<String>,
    pub release_mbid: Option<String>,
}

/// Lightweight index entry loaded once per library scan for skip and stale detection.
#[derive(Debug, Clone)]
pub struct TrackScanEntry {
    pub id: i64,
    pub album_id: Option<i64>,
    pub file_size: i64,
    pub modified_time: i64,
    pub visited: bool,
}

/// Playback queue cursor/mode subset persisted independently from `items`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QueueCursorState {
    pub current_index: Option<usize>,
    pub loop_mode: domain::queue::LoopMode,
    pub shuffle: bool,
    pub shuffle_cursor: usize,
}
