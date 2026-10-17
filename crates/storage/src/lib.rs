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

            CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
            CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
            CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path);
            CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(album_artist);
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Zgodność wsteczna dla istniejących baz danych
        let _ = sqlx::query("ALTER TABLE albums ADD COLUMN release_mbid TEXT;")
            .execute(&self.pool)
            .await;

        // Inicjalizacja domyślnych motywów anime, jeśli tabela jest pusta
        let theme_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM themes;")
            .fetch_one(&self.pool)
            .await?;

        if theme_count == 0 {
            for theme in domain::default_themes() {
                self.save_theme(&theme).await?;
            }
            if self.get_app_setting("active_theme_id").await?.is_none() {
                self.set_app_setting("active_theme_id", "cyber-kitsune")
                    .await?;
            }
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
                duration_ms, format, sample_rate, channels, bit_depth, file_size, modified_time
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
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
                modified_time = excluded.modified_time
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
        .fetch_one(&self.pool)
        .await?;

        Ok(rec.get::<i64, _>("id"))
    }

    /// Pobiera utwór po ścieżce na dysku.
    pub async fn get_track_by_path(&self, path: &str) -> Result<Option<TrackRecord>, StorageError> {
        let res = sqlx::query_as::<_, TrackRecord>("SELECT * FROM tracks WHERE path = ?1 LIMIT 1;")
            .bind(path)
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
        };

        let track_id = db.upsert_track(&track).await.unwrap();
        assert!(track_id > 0);

        // 3. Weryfikacja pobierania
        let fetched = db.get_track_by_path("/music/sparkle.flac").await.unwrap();
        assert!(fetched.is_some());
        let fetched_track = fetched.unwrap();
        assert_eq!(fetched_track.title, "Sparkle");
        assert_eq!(fetched_track.duration_ms, 538000);

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
        assert_eq!(themes.len(), 4); // 4 domyślne motywy zainicjowane migracją
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
    }
}
