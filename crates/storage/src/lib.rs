//! Moduł pamięci trwałej i bazy SQLite (sqlx).

use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use sqlx::{FromRow, Row};
use std::path::Path;
use std::str::FromStr;
use thiserror::Error;
use tracing::info;

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

/// Podsumowanie statystyk odsłuchów (Recap / Unwrapped)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct RecapSummaryDto {
    pub period: String,
    pub total_listened_ms: i64,
    pub tracks_played_count: i64,
    pub top_tracks: Vec<TrackRecord>,
    pub top_artists: Vec<(String, i64)>,
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

/// Główny interfejs bazy danych SQLite.
#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// Tworzy bazę danych w pamięci RAM (przydatne do testów i sesji ulotnych).
    pub async fn new_in_memory() -> Result<Self, StorageError> {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect("sqlite::memory:")
            .await?;

        let db = Self { pool };
        db.run_migrations().await?;
        Ok(db)
    }

    /// Otwiera lub tworzy bazę danych w podanej ścieżce na dysku.
    pub async fn open(path: impl AsRef<Path>) -> Result<Self, StorageError> {
        let path_str = path.as_ref().to_str().unwrap_or("auralune.db");
        let opts = SqliteConnectOptions::from_str(path_str)?
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(opts)
            .await?;

        let db = Self { pool };
        db.run_migrations().await?;
        info!("Baza danych SQLite zainicjalizowana: {}", path_str);
        Ok(db)
    }

    /// Inicjalizuje tabele i indeksy w bazie danych.
    pub async fn run_migrations(&self) -> Result<(), StorageError> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS artists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS albums (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                album_artist TEXT NOT NULL,
                year INTEGER,
                cover_path TEXT,
                release_mbid TEXT,
                UNIQUE(title, album_artist)
            );

            CREATE TABLE IF NOT EXISTS tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                album_artist TEXT,
                album_id INTEGER REFERENCES albums(id),
                disc_no INTEGER,
                track_no INTEGER,
                duration_ms INTEGER NOT NULL,
                format TEXT NOT NULL,
                sample_rate INTEGER NOT NULL,
                channels INTEGER NOT NULL,
                bit_depth INTEGER,
                file_size INTEGER NOT NULL,
                modified_time INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS playback_bookmarks (
                track_id INTEGER PRIMARY KEY REFERENCES tracks(id),
                position_ms INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS dsp_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                engine TEXT NOT NULL,
                pitch_semitones REAL NOT NULL,
                tempo_ratio REAL NOT NULL,
                rate_ratio REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS themes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                schema_version INTEGER NOT NULL,
                tokens_json TEXT NOT NULL,
                background_ref TEXT,
                overlay_opacity REAL NOT NULL,
                blur_radius REAL NOT NULL,
                attribution TEXT
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS playlist_tracks (
                playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
                track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                position INTEGER NOT NULL,
                PRIMARY KEY (playlist_id, track_id, position)
            );

            CREATE TABLE IF NOT EXISTS queue_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                queue_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
            CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
            CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path);
            CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(album_artist);
            CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Zgodność wsteczna dla istniejących baz danych
        let _ = sqlx::query("ALTER TABLE albums ADD COLUMN release_mbid TEXT;")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN is_favorite BOOLEAN DEFAULT 0;")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN play_count INTEGER DEFAULT 0;")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN last_played_at INTEGER;")
            .execute(&self.pool)
            .await;
        let _ =
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_tracks_favorite ON tracks(is_favorite);")
                .execute(&self.pool)
                .await;
        let _ = sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_tracks_last_played ON tracks(last_played_at);",
        )
        .execute(&self.pool)
        .await;
        let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN total_play_time_ms INTEGER DEFAULT 0;")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN bpm REAL;")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN initial_key TEXT;")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN replaygain_track_gain REAL;")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN replaygain_track_peak REAL;")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN rating INTEGER DEFAULT 0;")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_tracks_rating ON tracks(rating);")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS listening_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                duration_ms INTEGER NOT NULL,
                played_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_listening_history_played ON listening_history(played_at);
            CREATE INDEX IF NOT EXISTS idx_listening_history_track ON listening_history(track_id);
            "#,
        )
        .execute(&self.pool)
        .await;

        // Inicjalizacja domyślnych motywów anime (upewniamy się, że każdy motyw istnieje)
        for theme in domain::default_themes() {
            if self.get_theme(&theme.id).await?.is_none() {
                self.save_theme(&theme).await?;
            }
        }
        if self.get_app_setting("active_theme_id").await?.is_none() {
            self.set_app_setting("active_theme_id", "cyber-kitsune")
                .await?;
        }

        Ok(())
    }

    /// Wstawia lub aktualizuje artystę i zwraca jego ID.
    pub async fn upsert_artist(&self, name: &str) -> Result<i64, StorageError> {
        let rec = sqlx::query(
            r#"
            INSERT INTO artists (name) VALUES (?1)
            ON CONFLICT(name) DO UPDATE SET name=excluded.name
            RETURNING id;
            "#,
        )
        .bind(name)
        .fetch_one(&self.pool)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Wstawia lub aktualizuje album i zwraca jego ID.
    pub async fn upsert_album(
        &self,
        title: &str,
        album_artist: &str,
        year: Option<i64>,
        cover_path: Option<&str>,
    ) -> Result<i64, StorageError> {
        let rec = sqlx::query(
            r#"
            INSERT INTO albums (title, album_artist, year, cover_path)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(title, album_artist) DO UPDATE SET
                year = COALESCE(excluded.year, albums.year),
                cover_path = COALESCE(excluded.cover_path, albums.cover_path)
            RETURNING id;
            "#,
        )
        .bind(title)
        .bind(album_artist)
        .bind(year)
        .bind(cover_path)
        .fetch_one(&self.pool)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Aktualizuje okładkę oraz identyfikator MBID dla albumu.
    pub async fn update_album_cover(
        &self,
        album_id: i64,
        cover_path: &str,
        release_mbid: Option<&str>,
    ) -> Result<(), StorageError> {
        sqlx::query(
            r#"
            UPDATE albums
            SET cover_path = ?1,
                release_mbid = COALESCE(?2, release_mbid)
            WHERE id = ?3;
            "#,
        )
        .bind(cover_path)
        .bind(release_mbid)
        .bind(album_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Wstawia lub aktualizuje utwór.
    pub async fn upsert_track(&self, track: &TrackRecord) -> Result<i64, StorageError> {
        let rec = sqlx::query(
            r#"
            INSERT INTO tracks (
                path, title, artist, album_artist, album_id, disc_no, track_no,
                duration_ms, format, sample_rate, channels, bit_depth, file_size, modified_time,
                bpm, initial_key, replaygain_track_gain, replaygain_track_peak
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
            ON CONFLICT(path) DO UPDATE SET
                title = excluded.title,
                artist = excluded.artist,
                album_artist = excluded.album_artist,
                album_id = excluded.album_id,
                disc_no = excluded.disc_no,
                track_no = excluded.track_no,
                duration_ms = excluded.duration_ms,
                format = excluded.format,
                sample_rate = excluded.sample_rate,
                channels = excluded.channels,
                bit_depth = excluded.bit_depth,
                file_size = excluded.file_size,
                modified_time = excluded.modified_time,
                bpm = COALESCE(excluded.bpm, tracks.bpm),
                initial_key = COALESCE(excluded.initial_key, tracks.initial_key),
                replaygain_track_gain = COALESCE(excluded.replaygain_track_gain, tracks.replaygain_track_gain),
                replaygain_track_peak = COALESCE(excluded.replaygain_track_peak, tracks.replaygain_track_peak)
            RETURNING id;
            "#,
        )
        .bind(&track.path)
        .bind(&track.title)
        .bind(&track.artist)
        .bind(&track.album_artist)
        .bind(track.album_id)
        .bind(track.disc_no)
        .bind(track.track_no)
        .bind(track.duration_ms)
        .bind(&track.format)
        .bind(track.sample_rate)
        .bind(track.channels)
        .bind(track.bit_depth)
        .bind(track.file_size)
        .bind(track.modified_time)
        .bind(track.bpm)
        .bind(&track.initial_key)
        .bind(track.replaygain_track_gain)
        .bind(track.replaygain_track_peak)
        .fetch_one(&self.pool)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Aktualizuje wykryty lub ręcznie ustawiony BPM oraz klucz muzyczny dla utworu.
    pub async fn update_track_key_bpm(
        &self,
        track_id: i64,
        bpm: f64,
        initial_key: &str,
    ) -> Result<(), StorageError> {
        sqlx::query("UPDATE tracks SET bpm = ?1, initial_key = ?2 WHERE id = ?3;")
            .bind(bpm)
            .bind(initial_key)
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Aktualizuje obliczone wartości ReplayGain (Track Gain i Track Peak) dla utworu.
    pub async fn update_track_replaygain(
        &self,
        track_id: i64,
        track_gain: f64,
        track_peak: f64,
    ) -> Result<(), StorageError> {
        sqlx::query(
            "UPDATE tracks SET replaygain_track_gain = ?1, replaygain_track_peak = ?2 WHERE id = ?3;",
        )
        .bind(track_gain)
        .bind(track_peak)
        .bind(track_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Pobiera zapisany BPM oraz klucz muzyczny dla danego utworu.
    pub async fn get_track_key_bpm(
        &self,
        track_id: i64,
    ) -> Result<Option<(f64, String)>, StorageError> {
        let row = sqlx::query("SELECT bpm, initial_key FROM tracks WHERE id = ?1 LIMIT 1;")
            .bind(track_id)
            .fetch_optional(&self.pool)
            .await?;
        if let Some(r) = row {
            let bpm: Option<f64> = r.try_get("bpm").ok();
            let key: Option<String> = r.try_get("initial_key").ok();
            if let (Some(b), Some(k)) = (bpm, key) {
                return Ok(Some((b, k)));
            }
        }
        Ok(None)
    }

    /// Powiązuje dany utwór z albumem.
    pub async fn link_track_to_album(
        &self,
        track_id: i64,
        album_id: i64,
    ) -> Result<(), StorageError> {
        sqlx::query("UPDATE tracks SET album_id = ?1 WHERE id = ?2;")
            .bind(album_id)
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Powiązuje nieprzypisane utwory o danej nazwie albumu z albumem.
    pub async fn link_tracks_by_album_title(
        &self,
        album_title: &str,
        album_id: i64,
    ) -> Result<(), StorageError> {
        sqlx::query(
            "UPDATE tracks SET album_id = ?1 WHERE (album_id IS NULL OR album_id = 0) AND (album_artist = ?2 OR artist = ?2);",
        )
        .bind(album_id)
        .bind(album_title)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Pobiera utwór po ścieżce na dysku.
    pub async fn get_track_by_path(&self, path: &str) -> Result<Option<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>("SELECT * FROM tracks WHERE path = ?1 LIMIT 1;")
            .bind(path)
            .fetch_optional(&self.pool)
            .await?;

        Ok(res)
    }

    /// Wyszukuje utwór po ścieżce lub URI (obsługuje prefiks file:// oraz dopasowanie elastyczne).
    pub async fn find_track_by_path_or_uri(
        &self,
        path_or_uri: &str,
    ) -> Result<Option<TrackRecord>, StorageError> {
        let clean_path = path_or_uri.strip_prefix("file://").unwrap_or(path_or_uri);
        let with_file_uri = format!("file://{}", clean_path);

        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE path = ?1 OR path = ?2 LIMIT 1;",
        )
        .bind(clean_path)
        .bind(&with_file_uri)
        .fetch_optional(&self.pool)
        .await?;

        Ok(res)
    }

    pub async fn get_track_by_id(&self, id: i64) -> Result<Option<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>("SELECT * FROM tracks WHERE id = ?1 LIMIT 1;")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(res)
    }

    /// Pobiera listę wszystkich utworów w bibliotece.
    pub async fn list_tracks(&self) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks ORDER BY artist, album_id, track_no, title;",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(res)
    }

    /// Pobiera listę wszystkich albumów w bibliotece.
    pub async fn list_albums(&self) -> Result<Vec<AlbumRecord>, StorageError> {
        let res = sqlx::query_as::<_, AlbumRecord>(
            "SELECT * FROM albums ORDER BY album_artist, year, title;",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(res)
    }

    /// Pobiera listę wszystkich wykonawców.
    pub async fn list_artists(&self) -> Result<Vec<ArtistRecord>, StorageError> {
        let res = sqlx::query_as::<_, ArtistRecord>("SELECT * FROM artists ORDER BY name;")
            .fetch_all(&self.pool)
            .await?;

        Ok(res)
    }

    /// Zapisuje pozycję odtwarzania (zakładkę) dla danego utworu.
    pub async fn save_bookmark(&self, track_id: i64, position_ms: u64) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        sqlx::query(
            r#"
            INSERT INTO playback_bookmarks (track_id, position_ms, updated_at)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(track_id) DO UPDATE SET
                position_ms = excluded.position_ms,
                updated_at = excluded.updated_at;
            "#,
        )
        .bind(track_id)
        .bind(position_ms as i64)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Pobiera zapisaną pozycję utworu.
    pub async fn get_bookmark(&self, track_id: i64) -> Result<Option<u64>, StorageError> {
        let rec = sqlx::query("SELECT position_ms FROM playback_bookmarks WHERE track_id = ?1;")
            .bind(track_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(rec.map(|r| r.get::<i64, _>("position_ms") as u64))
    }

    /// Usuwa zakładkę odtwarzania dla danego utworu.
    pub async fn delete_bookmark(&self, track_id: i64) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM playback_bookmarks WHERE track_id = ?1;")
            .bind(track_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Zapisuje preset DSP.
    pub async fn save_dsp_preset(
        &self,
        name: &str,
        engine: &str,
        pitch: f64,
        tempo: f64,
        rate: f64,
    ) -> Result<i64, StorageError> {
        let rec = sqlx::query(
            r#"
            INSERT INTO dsp_presets (name, engine, pitch_semitones, tempo_ratio, rate_ratio)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(name) DO UPDATE SET
                engine = excluded.engine,
                pitch_semitones = excluded.pitch_semitones,
                tempo_ratio = excluded.tempo_ratio,
                rate_ratio = excluded.rate_ratio
            RETURNING id;
            "#,
        )
        .bind(name)
        .bind(engine)
        .bind(pitch)
        .bind(tempo)
        .bind(rate)
        .fetch_one(&self.pool)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Pobiera presety DSP.
    pub async fn list_dsp_presets(&self) -> Result<Vec<DspPresetRecord>, StorageError> {
        let res = sqlx::query_as::<_, DspPresetRecord>("SELECT * FROM dsp_presets ORDER BY name;")
            .fetch_all(&self.pool)
            .await?;

        Ok(res)
    }

    /// Usuwa z bazy utwory, których ścieżek nie ma już na liście aktywnych plików.
    pub async fn delete_stale_tracks(
        &self,
        active_paths: &[String],
    ) -> Result<usize, StorageError> {
        let all_tracks = self.list_tracks().await?;
        let active_set: std::collections::HashSet<&str> =
            active_paths.iter().map(|s| s.as_str()).collect();

        let mut deleted_count = 0;
        for t in all_tracks {
            if !active_set.contains(t.path.as_str()) {
                sqlx::query("DELETE FROM tracks WHERE id = ?1;")
                    .bind(t.id)
                    .execute(&self.pool)
                    .await?;
                deleted_count += 1;
            }
        }

        Ok(deleted_count)
    }

    /// Zapisuje lub aktualizuje motyw w bazie danych.
    pub async fn save_theme(&self, theme: &domain::Theme) -> Result<(), StorageError> {
        theme.validate().map_err(StorageError::Migration)?;
        let tokens_json = serde_json::to_string(&theme.tokens)
            .map_err(|e| StorageError::Migration(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO themes (
                id, name, schema_version, tokens_json, background_ref, overlay_opacity, blur_radius, attribution
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                schema_version = excluded.schema_version,
                tokens_json = excluded.tokens_json,
                background_ref = excluded.background_ref,
                overlay_opacity = excluded.overlay_opacity,
                blur_radius = excluded.blur_radius,
                attribution = excluded.attribution;
            "#,
        )
        .bind(&theme.id)
        .bind(&theme.name)
        .bind(theme.schema_version as i64)
        .bind(&tokens_json)
        .bind(&theme.background_ref)
        .bind(theme.overlay_opacity as f64)
        .bind(theme.blur_radius as f64)
        .bind(&theme.attribution)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Pobiera motyw po ID.
    pub async fn get_theme(&self, id: &str) -> Result<Option<domain::Theme>, StorageError> {
        let row = sqlx::query(
            "SELECT id, name, schema_version, tokens_json, background_ref, overlay_opacity, blur_radius, attribution FROM themes WHERE id = ?1 LIMIT 1;"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(r) = row {
            let tokens_json: String = r.get("tokens_json");
            let tokens: domain::ThemeTokens = serde_json::from_str(&tokens_json)
                .map_err(|e| StorageError::Migration(e.to_string()))?;

            Ok(Some(domain::Theme {
                id: r.get("id"),
                name: r.get("name"),
                schema_version: r.get::<i64, _>("schema_version") as u32,
                tokens,
                background_ref: r.get("background_ref"),
                overlay_opacity: r.get::<f64, _>("overlay_opacity") as f32,
                blur_radius: r.get::<f64, _>("blur_radius") as f32,
                attribution: r.get("attribution"),
            }))
        } else {
            Ok(None)
        }
    }

    /// Pobiera listę wszystkich dostępnych motywów.
    pub async fn list_themes(&self) -> Result<Vec<domain::Theme>, StorageError> {
        let rows = sqlx::query(
            "SELECT id, name, schema_version, tokens_json, background_ref, overlay_opacity, blur_radius, attribution FROM themes ORDER BY id;"
        )
        .fetch_all(&self.pool)
        .await?;

        let mut themes = Vec::with_capacity(rows.len());
        for r in rows {
            let tokens_json: String = r.get("tokens_json");
            let tokens: domain::ThemeTokens = serde_json::from_str(&tokens_json)
                .map_err(|e| StorageError::Migration(e.to_string()))?;

            themes.push(domain::Theme {
                id: r.get("id"),
                name: r.get("name"),
                schema_version: r.get::<i64, _>("schema_version") as u32,
                tokens,
                background_ref: r.get("background_ref"),
                overlay_opacity: r.get::<f64, _>("overlay_opacity") as f32,
                blur_radius: r.get::<f64, _>("blur_radius") as f32,
                attribution: r.get("attribution"),
            });
        }

        Ok(themes)
    }

    /// Zapisuje ustawienie aplikacji (klucz-wartość).
    pub async fn set_app_setting(&self, key: &str, value: &str) -> Result<(), StorageError> {
        sqlx::query(
            r#"
            INSERT INTO app_settings (key, value) VALUES (?1, ?2)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            "#,
        )
        .bind(key)
        .bind(value)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Pobiera ustawienie aplikacji.
    pub async fn get_app_setting(&self, key: &str) -> Result<Option<String>, StorageError> {
        let row = sqlx::query("SELECT value FROM app_settings WHERE key = ?1 LIMIT 1;")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;

        Ok(row.map(|r| r.get("value")))
    }

    /// Tworzy nową playlistę i zwraca jej ID.
    pub async fn create_playlist(&self, name: &str) -> Result<i64, StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let rec = sqlx::query(
            r#"
            INSERT INTO playlists (name, created_at)
            VALUES (?1, ?2)
            RETURNING id;
            "#,
        )
        .bind(name)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Usuwa playlistę wraz ze wszystkimi powiązanymi wpisami utworów.
    pub async fn delete_playlist(&self, playlist_id: i64) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM playlists WHERE id = ?1;")
            .bind(playlist_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Zwraca listę wszystkich playlist wraz z liczbą przypisanych utworów.
    pub async fn list_playlists(&self) -> Result<Vec<domain::Playlist>, StorageError> {
        let rows = sqlx::query(
            r#"
            SELECT p.id, p.name, p.created_at, COUNT(pt.track_id) as track_count
            FROM playlists p
            LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
            GROUP BY p.id
            ORDER BY p.name ASC;
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let playlists = rows
            .into_iter()
            .map(|r| domain::Playlist {
                id: r.get("id"),
                name: r.get("name"),
                created_at: r.get("created_at"),
                track_count: r.get::<i64, _>("track_count") as usize,
            })
            .collect();

        Ok(playlists)
    }

    /// Dodaje utwór na koniec wybranej playlisty.
    pub async fn add_track_to_playlist(
        &self,
        playlist_id: i64,
        track_id: i64,
    ) -> Result<(), StorageError> {
        let next_pos: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?1;",
        )
        .bind(playlist_id)
        .fetch_one(&self.pool)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO playlist_tracks (playlist_id, track_id, position)
            VALUES (?1, ?2, ?3);
            "#,
        )
        .bind(playlist_id)
        .bind(track_id)
        .bind(next_pos)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Usuwa utwór z playlisty.
    pub async fn remove_track_from_playlist(
        &self,
        playlist_id: i64,
        track_id: i64,
    ) -> Result<(), StorageError> {
        sqlx::query("DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2;")
            .bind(playlist_id)
            .bind(track_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Pobiera utwory z playlisty z zachowaniem kolejności `position`.
    pub async fn get_playlist_tracks(
        &self,
        playlist_id: i64,
    ) -> Result<Vec<TrackRecord>, StorageError> {
        let rows = sqlx::query_as::<_, TrackRecord>(
            r#"
            SELECT t.id, t.path, t.title, t.artist, t.album_artist, t.album_id,
                   t.disc_no, t.track_no, t.duration_ms, t.format, t.sample_rate,
                   t.channels, t.bit_depth, t.file_size, t.modified_time
            FROM tracks t
            JOIN playlist_tracks pt ON t.id = pt.track_id
            WHERE pt.playlist_id = ?1
            ORDER BY pt.position ASC;
            "#,
        )
        .bind(playlist_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /// Zapisuje bieżący stan kolejki odtwarzania.
    pub async fn save_queue_state(
        &self,
        queue: &domain::PlaybackQueue,
    ) -> Result<(), StorageError> {
        let queue_json = serde_json::to_string(queue)
            .map_err(|e| StorageError::Migration(format!("Błąd serializacji kolejki: {}", e)))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        sqlx::query(
            r#"
            INSERT INTO queue_state (id, queue_json, updated_at)
            VALUES (1, ?1, ?2)
            ON CONFLICT(id) DO UPDATE SET
                queue_json = excluded.queue_json,
                updated_at = excluded.updated_at;
            "#,
        )
        .bind(queue_json)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Ładuje zapisany stan kolejki odtwarzania.
    pub async fn load_queue_state(&self) -> Result<Option<domain::PlaybackQueue>, StorageError> {
        let row = sqlx::query("SELECT queue_json FROM queue_state WHERE id = 1 LIMIT 1;")
            .fetch_optional(&self.pool)
            .await?;

        if let Some(r) = row {
            let json_str: String = r.get("queue_json");
            let q: domain::PlaybackQueue = serde_json::from_str(&json_str).map_err(|e| {
                StorageError::Migration(format!("Błąd deserializacji kolejki: {}", e))
            })?;
            Ok(Some(q))
        } else {
            Ok(None)
        }
    }

    /// Przełącza status ulubionego (is_favorite) dla danego utworu.
    pub async fn toggle_favorite(&self, track_id: i64) -> Result<bool, StorageError> {
        let current: Option<bool> =
            sqlx::query_scalar("SELECT is_favorite FROM tracks WHERE id = ?1;")
                .bind(track_id)
                .fetch_optional(&self.pool)
                .await?;
        let new_val = !current.unwrap_or(false);
        sqlx::query("UPDATE tracks SET is_favorite = ?1 WHERE id = ?2;")
            .bind(new_val)
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(new_val)
    }

    /// Odnotowuje odsłuchanie utworu (zwiększa play_count i aktualizuje last_played_at).
    pub async fn record_track_play(&self, track_id: i64) -> Result<(), StorageError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        sqlx::query(
            "UPDATE tracks SET play_count = COALESCE(play_count, 0) + 1, last_played_at = ?1 WHERE id = ?2;",
        )
        .bind(now)
        .bind(track_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Odnotowuje czas odtwarzania utworu w milisekundach (zwiększa total_play_time_ms i dodaje wpis do listening_history).
    pub async fn record_track_listening(
        &self,
        track_id: i64,
        duration_ms: i64,
    ) -> Result<(), StorageError> {
        if duration_ms <= 0 {
            return Ok(());
        }
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        sqlx::query(
            "UPDATE tracks SET total_play_time_ms = COALESCE(total_play_time_ms, 0) + ?1, last_played_at = ?2 WHERE id = ?3;",
        )
        .bind(duration_ms)
        .bind(now)
        .bind(track_id)
        .execute(&self.pool)
        .await?;

        sqlx::query(
            "INSERT INTO listening_history (track_id, duration_ms, played_at) VALUES (?1, ?2, ?3);",
        )
        .bind(track_id)
        .bind(duration_ms)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Pobiera podsumowanie odsłuchów dla zadanego okresu (np. od danego timestampu UTC).
    pub async fn get_recap_summary(
        &self,
        period: &str,
        since_epoch_secs: i64,
    ) -> Result<RecapSummaryDto, StorageError> {
        let total_row = sqlx::query(
            "SELECT COALESCE(SUM(duration_ms), 0) as total_ms, COUNT(DISTINCT track_id) as tracks_count FROM listening_history WHERE played_at >= ?1;",
        )
        .bind(since_epoch_secs)
        .fetch_one(&self.pool)
        .await?;

        let total_listened_ms: i64 = total_row.try_get("total_ms").unwrap_or(0);
        let tracks_played_count: i64 = total_row.try_get("tracks_count").unwrap_or(0);

        let top_track_rows = sqlx::query(
            r#"
            SELECT t.*
            FROM tracks t
            JOIN (
                SELECT track_id, SUM(duration_ms) as dur
                FROM listening_history
                WHERE played_at >= ?1
                GROUP BY track_id
                ORDER BY dur DESC
                LIMIT 5
            ) h ON t.id = h.track_id;
            "#,
        )
        .bind(since_epoch_secs)
        .fetch_all(&self.pool)
        .await?;

        let mut top_tracks = Vec::new();
        for row in top_track_rows {
            if let Ok(t) = TrackRecord::from_row(&row) {
                top_tracks.push(t);
            }
        }

        if top_tracks.is_empty() {
            top_tracks = sqlx::query_as::<_, TrackRecord>(
                "SELECT * FROM tracks WHERE play_count > 0 ORDER BY play_count DESC, total_play_time_ms DESC LIMIT 5;",
            )
            .fetch_all(&self.pool)
            .await
            .unwrap_or_default();
        }

        let artist_rows = sqlx::query(
            r#"
            SELECT t.artist, SUM(h.duration_ms) as total_dur
            FROM listening_history h
            JOIN tracks t ON t.id = h.track_id
            WHERE h.played_at >= ?1 AND t.artist IS NOT NULL AND t.artist != ''
            GROUP BY t.artist
            ORDER BY total_dur DESC
            LIMIT 5;
            "#,
        )
        .bind(since_epoch_secs)
        .fetch_all(&self.pool)
        .await?;

        let mut top_artists = Vec::new();
        for r in artist_rows {
            let artist: String = r.try_get("artist").unwrap_or_default();
            let dur: i64 = r.try_get("total_dur").unwrap_or(0);
            if !artist.is_empty() {
                top_artists.push((artist, dur));
            }
        }

        if top_artists.is_empty() {
            let fallback_artists = sqlx::query(
                "SELECT artist, SUM(COALESCE(play_count, 0)) as total_plays FROM tracks WHERE artist IS NOT NULL AND artist != '' GROUP BY artist ORDER BY total_plays DESC LIMIT 5;",
            )
            .fetch_all(&self.pool)
            .await?;
            for r in fallback_artists {
                let artist: String = r.try_get("artist").unwrap_or_default();
                let plays: i64 = r.try_get("total_plays").unwrap_or(0);
                if plays > 0 {
                    top_artists.push((artist, plays * 180_000));
                }
            }
        }

        Ok(RecapSummaryDto {
            period: period.to_string(),
            total_listened_ms,
            tracks_played_count,
            top_tracks,
            top_artists,
        })
    }

    /// Resetuje licznik odtworzeń dla danego utworu.
    pub async fn reset_track_plays(&self, track_id: i64) -> Result<(), StorageError> {
        sqlx::query("UPDATE tracks SET play_count = 0, last_played_at = NULL WHERE id = ?1;")
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Pobiera utwory oznaczone jako ulubione (Favorites).
    pub async fn list_favorite_tracks(&self) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE is_favorite = 1 ORDER BY artist, title;",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Pobiera ostatnio odtwarzane utwory (History).
    pub async fn list_recently_played_tracks(
        &self,
        limit: i64,
    ) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE last_played_at IS NOT NULL ORDER BY last_played_at DESC LIMIT ?1;",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Pobiera najczęściej odtwarzane utwory (Top Played).
    pub async fn list_top_played_tracks(
        &self,
        limit: i64,
    ) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE play_count > 0 ORDER BY play_count DESC LIMIT ?1;",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Pobiera utwory w formacie Hi-Res Audio (24-bit lub częstotliwość > 48000 Hz).
    pub async fn list_hires_tracks(&self) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE (bit_depth IS NOT NULL AND bit_depth >= 24) OR sample_rate > 48000 ORDER BY artist, title;",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Ustawia ocenę gwiazdkową (0-5) dla danego utworu.
    pub async fn set_track_rating(&self, track_id: i64, rating: i64) -> Result<(), StorageError> {
        let clamped = rating.clamp(0, 5);
        sqlx::query("UPDATE tracks SET rating = ?1 WHERE id = ?2;")
            .bind(clamped)
            .bind(track_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Aktualizuje edytowane metadane utworu i opcjonalnie albumu w bazie SQLite.
    #[allow(clippy::too_many_arguments)]
    pub async fn update_track_metadata(
        &self,
        track_id: i64,
        title: &str,
        artist: &str,
        album_artist: Option<&str>,
        track_no: Option<i64>,
        disc_no: Option<i64>,
        album_title: Option<&str>,
        year: Option<i64>,
    ) -> Result<(), StorageError> {
        let mut album_id = None;
        if let Some(al_title) = album_title {
            let al_artist = album_artist.unwrap_or(artist);
            let id = self.upsert_album(al_title, al_artist, year, None).await?;
            album_id = Some(id);
        }

        sqlx::query(
            r#"
            UPDATE tracks
            SET title = ?1,
                artist = ?2,
                album_artist = ?3,
                album_id = COALESCE(?4, album_id),
                track_no = ?5,
                disc_no = ?6
            WHERE id = ?7;
            "#,
        )
        .bind(title)
        .bind(artist)
        .bind(album_artist)
        .bind(album_id)
        .bind(track_no)
        .bind(disc_no)
        .bind(track_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Pobiera utwory zapomniane (nigdy nieodtwarzane lub play_count = 0).
    pub async fn list_forgotten_tracks(
        &self,
        limit: i64,
    ) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE play_count IS NULL OR play_count = 0 ORDER BY RANDOM() LIMIT ?1;",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Pobiera utwory o wysokim BPM (np. >= 130 BPM).
    pub async fn list_high_bpm_tracks(
        &self,
        min_bpm: f64,
    ) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE bpm IS NOT NULL AND bpm >= ?1 ORDER BY bpm DESC;",
        )
        .bind(min_bpm)
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }

    /// Pobiera najwyżej ocenione utwory (rating >= 4).
    pub async fn list_top_rated_tracks(&self) -> Result<Vec<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>(
            "SELECT * FROM tracks WHERE rating IS NOT NULL AND rating >= 4 ORDER BY rating DESC, play_count DESC;",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(res)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_database_crud_and_bookmarks() {
        let db = Database::new_in_memory().await.unwrap();

        // 1. Dodawanie artysty i albumu
        let artist_id = db.upsert_artist("RADWIMPS").await.unwrap();
        assert!(artist_id > 0);

        let album_id = db
            .upsert_album("Your Name.", "RADWIMPS", Some(2016), None)
            .await
            .unwrap();
        assert!(album_id > 0);

        // 2. Dodawanie utworu
        let track = TrackRecord {
            id: 0,
            path: "/music/sparkle.flac".to_string(),
            title: "Sparkle".to_string(),
            artist: "RADWIMPS".to_string(),
            album_artist: Some("RADWIMPS".to_string()),
            album_id: Some(album_id),
            disc_no: Some(1),
            track_no: Some(8),
            duration_ms: 538000,
            format: "FLAC".to_string(),
            sample_rate: 48000,
            channels: 2,
            bit_depth: Some(24),
            file_size: 65432100,
            modified_time: 1700000000,
            is_favorite: None,
            play_count: None,
            last_played_at: None,
            total_play_time_ms: None,
            bpm: None,
            initial_key: None,
            replaygain_track_gain: None,
            replaygain_track_peak: None,
            rating: None,
        };

        let track_id = db.upsert_track(&track).await.unwrap();
        assert!(track_id > 0);

        // 3. Weryfikacja pobierania
        let fetched = db.get_track_by_path("/music/sparkle.flac").await.unwrap();
        assert!(fetched.is_some());
        let fetched_track = fetched.unwrap();
        assert_eq!(fetched_track.title, "Sparkle");
        assert_eq!(fetched_track.duration_ms, 538000);

        // Test ulubionych i statystyk odtworzeń
        let is_fav = db.toggle_favorite(track_id).await.unwrap();
        assert!(is_fav);
        let favs = db.list_favorite_tracks().await.unwrap();
        assert_eq!(favs.len(), 1);
        assert_eq!(favs[0].title, "Sparkle");

        // Test oceny gwiazdkowej
        db.set_track_rating(track_id, 5).await.unwrap();
        let rated = db.list_top_rated_tracks().await.unwrap();
        assert_eq!(rated.len(), 1);
        assert_eq!(rated[0].rating, Some(5));

        // Test aktualizacji metadanych
        db.update_track_metadata(
            track_id,
            "Sparkle (Movie Ver.)",
            "RADWIMPS",
            Some("RADWIMPS"),
            Some(8),
            Some(1),
            Some("Your Name."),
            Some(2016),
        )
        .await
        .unwrap();
        let updated = db.get_track_by_id(track_id).await.unwrap().unwrap();
        assert_eq!(updated.title, "Sparkle (Movie Ver.)");

        db.record_track_play(track_id).await.unwrap();
        db.record_track_listening(track_id, 45000).await.unwrap();
        let top = db.list_top_played_tracks(10).await.unwrap();
        assert_eq!(top.len(), 1);
        assert_eq!(top[0].play_count, Some(1));
        assert_eq!(top[0].total_play_time_ms, Some(45000));

        let recap = db.get_recap_summary("week", 0).await.unwrap();
        assert_eq!(recap.total_listened_ms, 45000);
        assert_eq!(recap.tracks_played_count, 1);
        assert_eq!(recap.top_tracks.len(), 1);
        assert_eq!(recap.top_artists.len(), 1);
        assert_eq!(recap.top_artists[0].0, "RADWIMPS");

        let hires = db.list_hires_tracks().await.unwrap();
        assert_eq!(hires.len(), 1);
        assert_eq!(hires[0].title, "Sparkle (Movie Ver.)");

        // 4. Test zakładki odtwarzania
        db.save_bookmark(track_id, 125000).await.unwrap();
        let pos = db.get_bookmark(track_id).await.unwrap();
        assert_eq!(pos, Some(125000));

        // 5. Test presetu DSP
        let preset_id = db
            .save_dsp_preset("Nightcore", "SoundTouch", 3.0, 1.25, 1.0)
            .await
            .unwrap();
        assert!(preset_id > 0);

        let presets = db.list_dsp_presets().await.unwrap();
        assert_eq!(presets.len(), 1);
        assert_eq!(presets[0].name, "Nightcore");
        assert_eq!(presets[0].pitch_semitones, 3.0);

        // 6. Test motywów anime i tokenów
        let themes = db.list_themes().await.unwrap();
        assert_eq!(themes.len(), 6); // 6 domyślnych motywów anime zainicjowanych migracją
        let active = db.get_app_setting("active_theme_id").await.unwrap();
        assert_eq!(active, Some("cyber-kitsune".to_string()));

        let cyber = db.get_theme("cyber-kitsune").await.unwrap();
        assert!(cyber.is_some());
        let mut custom = cyber.unwrap();
        custom.id = "custom-synth".to_string();
        custom.name = "Custom Synth".to_string();
        custom.overlay_opacity = 0.65;
        custom.blur_radius = 16.0;
        db.save_theme(&custom).await.unwrap();

        let fetched_custom = db.get_theme("custom-synth").await.unwrap().unwrap();
        assert_eq!(fetched_custom.name, "Custom Synth");
        assert_eq!(fetched_custom.overlay_opacity, 0.65);
        assert_eq!(fetched_custom.blur_radius, 16.0);

        db.set_app_setting("active_theme_id", "custom-synth")
            .await
            .unwrap();
        assert_eq!(
            db.get_app_setting("active_theme_id").await.unwrap(),
            Some("custom-synth".to_string())
        );

        // 7. Test playlist i kolejki
        let pl_id = db.create_playlist("Anime Favorites").await.unwrap();
        assert!(pl_id > 0);

        db.add_track_to_playlist(pl_id, track_id).await.unwrap();
        let playlists = db.list_playlists().await.unwrap();
        assert_eq!(playlists.len(), 1);
        assert_eq!(playlists[0].name, "Anime Favorites");
        assert_eq!(playlists[0].track_count, 1);

        let pl_tracks = db.get_playlist_tracks(pl_id).await.unwrap();
        assert_eq!(pl_tracks.len(), 1);
        assert_eq!(pl_tracks[0].title, "Sparkle (Movie Ver.)");

        // Test persystencji kolejki odtwarzania
        let mut queue = domain::PlaybackQueue::new();
        queue.add_item(domain::QueueItem {
            id: "q-1".to_string(),
            track_id: Some(track_id),
            uri: "/music/sparkle.flac".to_string(),
            title: "Sparkle".to_string(),
            artist: "RADWIMPS".to_string(),
            album: Some("Your Name.".to_string()),
            duration_ms: 538000,
        });
        queue.set_loop_mode(domain::LoopMode::Track);
        queue.set_shuffle(true);

        db.save_queue_state(&queue).await.unwrap();
        let loaded_queue = db.load_queue_state().await.unwrap();
        assert!(loaded_queue.is_some());
        let lq = loaded_queue.unwrap();
        assert_eq!(lq.items.len(), 1);
        assert_eq!(lq.items[0].title, "Sparkle");
        assert_eq!(lq.loop_mode, domain::LoopMode::Track);
        assert!(lq.shuffle);

        // Test usunięcia utworu i playlisty
        db.remove_track_from_playlist(pl_id, track_id)
            .await
            .unwrap();
        let empty_tracks = db.get_playlist_tracks(pl_id).await.unwrap();
        assert!(empty_tracks.is_empty());

        db.delete_playlist(pl_id).await.unwrap();
        let empty_pls = db.list_playlists().await.unwrap();
        assert!(empty_pls.is_empty());
    }
}
