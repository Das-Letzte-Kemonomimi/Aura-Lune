//! SQLite database schema, optimisation pragmas, indexes and version migrations.

use crate::{Database, StorageError};

impl Database {
    /// Initialises the database tables and indexes and applies the schema migrations.
    pub async fn run_migrations(&self) -> Result<(), StorageError> {
        // Performance pragmas (cache, temp_store, mmap) are set per connection
        // in `Database::connect_options`, not here (here they would reach only one pool connection).
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
                rating INTEGER DEFAULT 0,
                added_at INTEGER NOT NULL DEFAULT 0
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
                updated_at INTEGER NOT NULL,
                cursor_json TEXT
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
                bands_json TEXT NOT NULL DEFAULT '[]',
                analyzer_version TEXT NOT NULL DEFAULT '',
                file_modified_time INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cover_lookup_attempts (
                album_id INTEGER PRIMARY KEY REFERENCES albums(id) ON DELETE CASCADE,
                status TEXT NOT NULL,
                attempted_at INTEGER NOT NULL,
                error_detail TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
            CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
            CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(album_artist);
            CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos ON playlist_tracks(playlist_id, position);
            CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);
            CREATE INDEX IF NOT EXISTS idx_tracks_dup_key ON tracks(LOWER(TRIM(title)), LOWER(TRIM(artist)));
            -- `tracks.path` already has an index from its UNIQUE constraint.
            DROP INDEX IF EXISTS idx_tracks_path;
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
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Backward compatibility: versioned migrations via PRAGMA user_version
        let user_version: i32 = sqlx::query_scalar("PRAGMA user_version;")
            .fetch_one(&self.pool)
            .await?;

        if user_version < 1 {
            self.migrate_v1().await?;
        }

        if user_version < 2 {
            self.migrate_v2().await?;
        }
        if user_version < 3 {
            self.migrate_v3().await?;
        }
        if user_version < 4 {
            self.migrate_v4().await?;
        }
        if user_version < 5 {
            self.migrate_v5().await?;
        }
        if user_version < 6 {
            self.migrate_v6().await?;
        }
        if user_version < 7 {
            self.migrate_v7().await?;
        }
        if user_version < 8 {
            self.migrate_v8().await?;
        }

        // Seed the default anime themes (make sure every theme exists)
        for theme in domain::default_themes() {
            if self.get_theme(&theme.id).await?.is_none() {
                self.save_theme(&theme).await?;
            }
        }
        if self.get_app_setting("active_theme_id").await?.is_none() {
            self.set_app_setting("active_theme_id", "cyber-kitsune")
                .await?;
        }

        sqlx::query("PRAGMA optimize=0x10002;")
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// v1: the statistics/analysis columns in `tracks`, `release_mbid` in `albums` and their indexes.
    ///
    /// Databases from before v1 lack these columns, so their indexes are created only here
    /// (in the first DDL block they would fail initialisation with "no such column").
    /// The whole step is one transaction: a failed ALTER does not mark the database as migrated.
    async fn migrate_v1(&self) -> Result<(), StorageError> {
        const TRACK_COLUMNS: &[(&str, &str)] = &[
            ("is_favorite", "BOOLEAN DEFAULT 0"),
            ("play_count", "INTEGER DEFAULT 0"),
            ("last_played_at", "INTEGER"),
            ("total_play_time_ms", "INTEGER DEFAULT 0"),
            ("bpm", "REAL"),
            ("initial_key", "TEXT"),
            ("replaygain_track_gain", "REAL"),
            ("replaygain_track_peak", "REAL"),
            ("rating", "INTEGER DEFAULT 0"),
        ];
        const ALBUM_COLUMNS: &[(&str, &str)] = &[("release_mbid", "TEXT")];

        let mut tx = self.pool.begin().await?;
        for (table, columns) in [("tracks", TRACK_COLUMNS), ("albums", ALBUM_COLUMNS)] {
            let existing: Vec<String> =
                sqlx::query_scalar("SELECT name FROM pragma_table_info(?);")
                    .bind(table)
                    .fetch_all(&mut *tx)
                    .await?;
            for (name, ddl) in columns {
                if existing.iter().any(|c| c == name) {
                    continue;
                }
                // Table and column names are constants from this file, never external data.
                sqlx::query(&format!("ALTER TABLE {table} ADD COLUMN {name} {ddl};"))
                    .execute(&mut *tx)
                    .await?;
            }
        }
        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_tracks_favorite ON tracks(is_favorite);
            CREATE INDEX IF NOT EXISTS idx_tracks_last_played ON tracks(last_played_at);
            CREATE INDEX IF NOT EXISTS idx_tracks_rating ON tracks(rating);
            PRAGMA user_version = 1;
            "#,
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Migration v2:
    /// - `playback_bookmarks.track_id` gets `ON DELETE CASCADE` (deleting a track with
    ///   a bookmark used to fail with a foreign key error),
    /// - repairs the `tracks.album_artist` column, where an older scanner stored the album title,
    /// - the `bpm` / `musical_key` / `camelot` columns in the chord and transcription analysis caches.
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

        // Harmonic metadata in the analysis cache (a fixed 120 BPM / "Detected" used to be returned).
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

    /// Migration v3: silence bounds cache (silence skipping during playback).
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

    /// Ensures `tracks.added_at` exists, backfills rows at 0 from `modified_time`, and creates its index.
    async fn ensure_tracks_added_at(
        tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    ) -> Result<(), StorageError> {
        let has_column: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pragma_table_info('tracks') WHERE name = 'added_at';",
        )
        .fetch_one(&mut **tx)
        .await?;
        if has_column == 0 {
            sqlx::query("ALTER TABLE tracks ADD COLUMN added_at INTEGER NOT NULL DEFAULT 0;")
                .execute(&mut **tx)
                .await?;
        }
        sqlx::query(
            r#"
            UPDATE tracks SET added_at = modified_time WHERE added_at = 0;
            CREATE INDEX IF NOT EXISTS idx_tracks_added_at ON tracks(added_at);
            "#,
        )
        .execute(&mut **tx)
        .await?;
        Ok(())
    }

    /// Migration v4: `tracks.added_at` (unix seconds when the track first entered the library).
    ///
    /// Existing rows are backfilled from the file modification time, the best available proxy.
    async fn migrate_v4(&self) -> Result<(), StorageError> {
        let mut tx = self.pool.begin().await?;
        Self::ensure_tracks_added_at(&mut tx).await?;
        sqlx::query("PRAGMA user_version = 4;")
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Migration v5: repairs databases stamped at `user_version = 4` before `tracks.added_at`
    /// existed and prunes orphaned empty albums left behind by failed or deleted track writes.
    async fn migrate_v5(&self) -> Result<(), StorageError> {
        let mut tx = self.pool.begin().await?;
        Self::ensure_tracks_added_at(&mut tx).await?;
        sqlx::query(
            r#"
            DELETE FROM albums
            WHERE NOT EXISTS (SELECT 1 FROM tracks t WHERE t.album_id = albums.id);
            PRAGMA user_version = 5;
            "#,
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Migration v6: tracks background cover-fetch attempts with per-album status & cooldowns.
    async fn migrate_v6(&self) -> Result<(), StorageError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS cover_lookup_attempts (
                album_id INTEGER PRIMARY KEY REFERENCES albums(id) ON DELETE CASCADE,
                status TEXT NOT NULL,
                attempted_at INTEGER NOT NULL,
                error_detail TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_cover_lookup_attempts_status
                ON cover_lookup_attempts(status, attempted_at);
            PRAGMA user_version = 6;
            "#,
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Migration v7: adds spectral band data, analyzer version, and file mtime to `track_waveforms`.
    async fn migrate_v7(&self) -> Result<(), StorageError> {
        let mut tx = self.pool.begin().await?;
        let existing: Vec<String> =
            sqlx::query_scalar("SELECT name FROM pragma_table_info('track_waveforms');")
                .fetch_all(&mut *tx)
                .await?;
        let new_columns = [
            ("bands_json", "TEXT NOT NULL DEFAULT '[]'"),
            ("analyzer_version", "TEXT NOT NULL DEFAULT ''"),
            ("file_modified_time", "INTEGER NOT NULL DEFAULT 0"),
        ];
        for (column, ddl) in new_columns {
            if !existing.iter().any(|c| c == column) {
                sqlx::query(&format!(
                    "ALTER TABLE track_waveforms ADD COLUMN {column} {ddl};"
                ))
                .execute(&mut *tx)
                .await?;
            }
        }
        sqlx::query("PRAGMA user_version = 7;")
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        Ok(())
    }

    /// Migration v8: drops redundant indexes (`idx_playlist_tracks_playlist`,
    /// `idx_track_waveforms_track`), creates `idx_playlist_tracks_pos`, and adds
    /// `queue_state.cursor_json` for cursor-only queue saves.
    async fn migrate_v8(&self) -> Result<(), StorageError> {
        let mut tx = self.pool.begin().await?;
        let existing_qs: Vec<String> =
            sqlx::query_scalar("SELECT name FROM pragma_table_info('queue_state');")
                .fetch_all(&mut *tx)
                .await?;
        if !existing_qs.iter().any(|c| c == "cursor_json") {
            sqlx::query("ALTER TABLE queue_state ADD COLUMN cursor_json TEXT;")
                .execute(&mut *tx)
                .await?;
        }
        sqlx::query(
            r#"
            DROP INDEX IF EXISTS idx_playlist_tracks_playlist;
            DROP INDEX IF EXISTS idx_track_waveforms_track;
            CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos
                ON playlist_tracks(playlist_id, position);
            PRAGMA user_version = 8;
            "#,
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }
}
