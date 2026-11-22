//! Modele danych, rekordy bazy SQLite oraz struktury DTO biblioteki i odtwarzacza.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("Błąd bazy danych SQLite: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("Błąd migracji: {0}")]
    Migration(String),
}

/// Rekord utworu w bazie danych.
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
}

impl TrackRecord {
    /// Buduje element kolejki odtwarzania z rekordu biblioteki.
    /// `album_title` to tytuł albumu (z tabeli `albums`), a nie wykonawca albumu.
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

/// Pojedynczy utwór w podsumowaniu Recap.
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

/// Pojedynczy wykonawca w podsumowaniu Recap.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct RecapTopArtistDto {
    pub artist: String,
    pub play_count: i64,
    pub total_time_ms: i64,
}

/// Podsumowanie statystyk odsłuchów (Recap / Unwrapped)
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

/// Grupa potencjalnych duplikatów utworu w bibliotece.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DuplicateGroup {
    pub key: String,
    pub count: usize,
    pub tracks: Vec<TrackRecord>,
}

/// Rekord albumu w bazie danych.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, PartialEq)]
pub struct AlbumRecord {
    pub id: i64,
    pub title: String,
    pub album_artist: String,
    pub year: Option<i64>,
    pub cover_path: Option<String>,
    pub release_mbid: Option<String>,
}

/// Rekord wykonawcy w bazie danych.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, PartialEq)]
pub struct ArtistRecord {
    pub id: i64,
    pub name: String,
}

/// Rekord presetu DSP w bazie danych.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, PartialEq)]
pub struct DspPresetRecord {
    pub id: i64,
    pub name: String,
    pub engine: String,
    pub pitch_semitones: f64,
    pub tempo_ratio: f64,
    pub rate_ratio: f64,
}

/// Dane wejściowe do zapisu wyniku analizy akordów w pamięci podręcznej.
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

/// Zapisany w pamięci podręcznej wynik analizy akordów.
/// Pola `bpm`, `musical_key` i `camelot` są puste dla wpisów sprzed migracji v2.
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

/// Zapisana w pamięci podręcznej transkrypcja nutowa.
/// `bpm` jest puste dla wpisów sprzed migracji v2.
#[derive(Debug, Clone, FromRow, PartialEq)]
pub struct CachedTrackTranscription {
    pub file_hash: String,
    pub analyzer_version: String,
    pub notes_json: String,
    pub bpm: Option<f64>,
}
