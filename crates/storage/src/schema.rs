//! Schemat bazy danych SQLite, pragmy optymalizacyjne, indeksy i migracje wersji.

use crate::{Database, StorageError};

impl Database {
    /// Inicjalizuje tabele i indeksy w bazie danych oraz aplikuje migracje schematu.
    pub async fn run_migrations(&self) -> Result<(), StorageError> {
        // Zastosuj pragmy optymalizacyjne dla SQLite (pamięć podręczna 64MB, temp_store w RAM, MMAP)
        let _ = sqlx::query("PRAGMA temp_store = MEMORY;")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("PRAGMA cache_size = -64000;")
            .execute(&self.pool)
            .await;
        let _ = sqlx::query("PRAGMA mmap_size = 268435456;")
            .execute(&self.pool)
            .await;

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
                modified_time INTEGER NOT NULL,
                is_favorite BOOLEAN DEFAULT 0,
                play_count INTEGER DEFAULT 0,
                last_played_at INTEGER,
                total_play_time_ms INTEGER DEFAULT 0,
                bpm REAL,
                initial_key TEXT,
                replaygain_track_gain REAL,
                replaygain_track_peak REAL,
                rating INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS playback_bookmarks (
                track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
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

            CREATE TABLE IF NOT EXISTS listening_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                duration_ms INTEGER NOT NULL,
                played_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS track_bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                position_ms INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS track_chords (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                file_hash TEXT NOT NULL,
                analyzer_version TEXT NOT NULL,
                beat_grid_json TEXT NOT NULL,
                chords_json TEXT NOT NULL,
                user_overrides_json TEXT,
                created_at INTEGER NOT NULL,
                bpm REAL,
                musical_key TEXT,
                camelot TEXT
            );

            CREATE TABLE IF NOT EXISTS track_transcriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                file_hash TEXT NOT NULL,
                analyzer_version TEXT NOT NULL,
                notes_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                bpm REAL
            );

            CREATE TABLE IF NOT EXISTS stem_tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                file_hash TEXT NOT NULL,
                model_name TEXT NOT NULL,
                stems_dir TEXT NOT NULL,
                vocals_path TEXT NOT NULL,
                drums_path TEXT NOT NULL,
                bass_path TEXT NOT NULL,
                other_path TEXT NOT NULL,
                piano_path TEXT,
                guitar_path TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ai_models (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                task_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                sha256 TEXT NOT NULL,
                license TEXT NOT NULL,
                download_url TEXT,
                description TEXT NOT NULL DEFAULT '',
                installed_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS stem_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id INTEGER NOT NULL,
                track_hash TEXT NOT NULL,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                album TEXT NOT NULL,
                cover_uri TEXT,
                status TEXT NOT NULL,
                progress REAL NOT NULL DEFAULT 0.0,
                model_name TEXT NOT NULL,
                disk_size_bytes INTEGER NOT NULL DEFAULT 0,
                active_mix_name TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS stem_project_channels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES stem_projects(id) ON DELETE CASCADE,
                stem_id TEXT NOT NULL,
                name TEXT NOT NULL,
                parent_stem TEXT,
                file_path TEXT NOT NULL,
                color_hex TEXT NOT NULL,
                quality_tier TEXT NOT NULL,
                volume REAL NOT NULL DEFAULT 0.75,
                pan REAL NOT NULL DEFAULT 0.0,
                mute INTEGER NOT NULL DEFAULT 0,
                solo INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS stem_project_mixes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL REFERENCES stem_projects(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                is_default INTEGER NOT NULL DEFAULT 0,
                channels_json TEXT NOT NULL,
                master_volume REAL NOT NULL DEFAULT 1.0,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS track_waveforms (
                track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
                sample_count INTEGER NOT NULL,
                peaks_json TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
            CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
            CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path);
            CREATE INDEX IF NOT EXISTS idx_tracks_favorite ON tracks(is_favorite);
            CREATE INDEX IF NOT EXISTS idx_tracks_last_played ON tracks(last_played_at);
            CREATE INDEX IF NOT EXISTS idx_tracks_rating ON tracks(rating);
            CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(album_artist);
            CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
            CREATE INDEX IF NOT EXISTS idx_listening_history_played ON listening_history(played_at);
            CREATE INDEX IF NOT EXISTS idx_listening_history_track ON listening_history(track_id);
            CREATE INDEX IF NOT EXISTS idx_track_bookmarks_track ON track_bookmarks(track_id);
            CREATE INDEX IF NOT EXISTS idx_track_chords_track ON track_chords(track_id);
            CREATE INDEX IF NOT EXISTS idx_track_chords_hash ON track_chords(file_hash);
            CREATE INDEX IF NOT EXISTS idx_track_transcriptions_track ON track_transcriptions(track_id);
            CREATE INDEX IF NOT EXISTS idx_track_transcriptions_hash ON track_transcriptions(file_hash);
            CREATE INDEX IF NOT EXISTS idx_stem_tracks_track ON stem_tracks(track_id);
            CREATE INDEX IF NOT EXISTS idx_stem_tracks_hash ON stem_tracks(file_hash);
            CREATE INDEX IF NOT EXISTS idx_stem_projects_track ON stem_projects(track_id);
            CREATE INDEX IF NOT EXISTS idx_stem_projects_hash ON stem_projects(track_hash);
            CREATE INDEX IF NOT EXISTS idx_stem_channels_proj ON stem_project_channels(project_id);
            CREATE INDEX IF NOT EXISTS idx_stem_mixes_proj ON stem_project_mixes(project_id);
            CREATE INDEX IF NOT EXISTS idx_track_waveforms_track ON track_waveforms(track_id);
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Zgodność wsteczna: wersjonowane migracje z użyciem PRAGMA user_version
        let user_version: i32 = sqlx::query_scalar("PRAGMA user_version;")
            .fetch_one(&self.pool)
            .await
            .unwrap_or(0);

        if user_version < 1 {
            let track_cols: Vec<String> =
                sqlx::query_scalar("SELECT name FROM pragma_table_info('tracks');")
                    .fetch_all(&self.pool)
                    .await
                    .unwrap_or_default();

            if !track_cols.contains(&"is_favorite".to_string()) {
                let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN is_favorite BOOLEAN DEFAULT 0;")
                    .execute(&self.pool)
                    .await;
            }
            if !track_cols.contains(&"play_count".to_string()) {
                let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN play_count INTEGER DEFAULT 0;")
                    .execute(&self.pool)
                    .await;
            }
            if !track_cols.contains(&"last_played_at".to_string()) {
                let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN last_played_at INTEGER;")
                    .execute(&self.pool)
                    .await;
            }
            if !track_cols.contains(&"total_play_time_ms".to_string()) {
                let _ = sqlx::query(
                    "ALTER TABLE tracks ADD COLUMN total_play_time_ms INTEGER DEFAULT 0;",
                )
                .execute(&self.pool)
                .await;
            }
            if !track_cols.contains(&"bpm".to_string()) {
                let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN bpm REAL;")
                    .execute(&self.pool)
                    .await;
            }
            if !track_cols.contains(&"initial_key".to_string()) {
                let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN initial_key TEXT;")
                    .execute(&self.pool)
                    .await;
            }
            if !track_cols.contains(&"replaygain_track_gain".to_string()) {
                let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN replaygain_track_gain REAL;")
                    .execute(&self.pool)
                    .await;
            }
            if !track_cols.contains(&"replaygain_track_peak".to_string()) {
                let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN replaygain_track_peak REAL;")
                    .execute(&self.pool)
                    .await;
            }
            if !track_cols.contains(&"rating".to_string()) {
                let _ = sqlx::query("ALTER TABLE tracks ADD COLUMN rating INTEGER DEFAULT 0;")
                    .execute(&self.pool)
                    .await;
            }

            let album_cols: Vec<String> =
                sqlx::query_scalar("SELECT name FROM pragma_table_info('albums');")
                    .fetch_all(&self.pool)
                    .await
                    .unwrap_or_default();
            if !album_cols.contains(&"release_mbid".to_string()) {
                let _ = sqlx::query("ALTER TABLE albums ADD COLUMN release_mbid TEXT;")
                    .execute(&self.pool)
                    .await;
            }

            let _ = sqlx::query("PRAGMA user_version = 1;")
                .execute(&self.pool)
                .await;
        }

        if user_version < 2 {
            self.migrate_v2().await?;
        }
        if user_version < 3 {
            self.migrate_v3().await?;
        }

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

    /// Migracja v2:
    /// - `playback_bookmarks.track_id` otrzymuje `ON DELETE CASCADE` (wcześniej usunięcie utworu
    ///   z zakładką kończyło się błędem klucza obcego),
    /// - naprawa kolumny `tracks.album_artist`, do której starszy skaner zapisywał tytuł albumu,
    /// - kolumny `bpm` / `musical_key` / `camelot` w pamięci podręcznej analiz akordów i transkrypcji.
    async fn migrate_v2(&self) -> Result<(), StorageError> {
        let mut tx = self.pool.begin().await?;

        sqlx::query(
            r#"
            CREATE TABLE playback_bookmarks_v2 (
                track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
                position_ms INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            INSERT INTO playback_bookmarks_v2 (track_id, position_ms, updated_at)
                SELECT track_id, position_ms, updated_at FROM playback_bookmarks
                WHERE track_id IN (SELECT id FROM tracks);
            DROP TABLE playback_bookmarks;
            ALTER TABLE playback_bookmarks_v2 RENAME TO playback_bookmarks;
            "#,
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            UPDATE tracks
            SET album_artist = (SELECT a.album_artist FROM albums a WHERE a.id = tracks.album_id)
            WHERE album_id IS NOT NULL
              AND album_artist = (SELECT a.title FROM albums a WHERE a.id = tracks.album_id);
            "#,
        )
        .execute(&mut *tx)
        .await?;

        // Metadane harmoniczne w pamięci podręcznej analiz (wcześniej zwracano stałe 120 BPM / "Detected").
        let new_columns = [
            ("track_chords", "bpm", "REAL"),
            ("track_chords", "musical_key", "TEXT"),
            ("track_chords", "camelot", "TEXT"),
            ("track_transcriptions", "bpm", "REAL"),
        ];
        for (table, column, ty) in new_columns {
            let existing: Vec<String> =
                sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}');"))
                    .fetch_all(&mut *tx)
                    .await?;
            if !existing.iter().any(|c| c == column) {
                sqlx::query(&format!("ALTER TABLE {table} ADD COLUMN {column} {ty};"))
                    .execute(&mut *tx)
                    .await?;
            }
        }

        sqlx::query("PRAGMA user_version = 2;")
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Migracja v3: pamięć podręczna granic ciszy (pomijanie ciszy podczas odtwarzania).
    async fn migrate_v3(&self) -> Result<(), StorageError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS track_silence_bounds (
                track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
                threshold_db REAL NOT NULL,
                start_ms INTEGER NOT NULL,
                end_ms INTEGER,
                file_modified_time INTEGER NOT NULL,
                analyzed_at INTEGER NOT NULL
            );
            "#,
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query("PRAGMA user_version = 3;")
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(())
    }
}
