//! Persistent storage and the SQLite database (sqlx).
//!
//! Aura-Lune's modular persistence layer:
//! - [`models`]: DTOs, database entities and the [`StorageError`] errors.
//! - [`schema`]: SQLite migrations, table schemas, indexes and default themes.
//! - [`library`]: artists, albums, tracks and duplicate detection.
//! - [`bookmarks`]: playback bookmarks and multi-point markers (cue points).
//! - [`settings`]: app settings, visual themes and DSP presets.
//! - [`playlists`]: the user's playlists and the playback queue state.
//! - [`stats`]: listening statistics, history, smart queries and yearly/periodic Recap.
//! - [`analysis`]: music analysis results (chords, transcription, waveform peaks, AI models).
//! - [`stems`]: stem separation results and multitrack mix projects (Moises-like).

pub mod analysis;
pub mod bookmarks;
pub mod library;
pub mod models;
pub mod playlists;
pub mod schema;
pub mod settings;
pub mod stats;
pub mod stems;

pub use models::*;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;
use std::str::FromStr;
use tracing::info;

/// Main SQLite database interface.
#[derive(Clone)]
pub struct Database {
    pub(crate) pool: SqlitePool,
}

impl Database {
    /// Performance pragmas applied to **every** pool connection (they are per connection):
    /// a 64 MB page cache, temp tables in RAM, 256 MB mmap.
    fn with_performance_pragmas(opts: SqliteConnectOptions) -> SqliteConnectOptions {
        opts.pragma("temp_store", "MEMORY")
            .pragma("cache_size", "-64000")
            .pragma("mmap_size", "268435456")
    }

    /// Creates an in-memory database (useful for tests and ephemeral sessions).
    ///
    /// Every `sqlite::memory:` connection is a separate, empty database, so the pool has exactly
    /// one connection; otherwise queries could reach a database without the schema.
    pub async fn new_in_memory() -> Result<Self, StorageError> {
        let opts =
            Self::with_performance_pragmas(SqliteConnectOptions::from_str("sqlite::memory:")?);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .idle_timeout(None)
            .max_lifetime(None)
            .connect_with(opts)
            .await?;

        let db = Self { pool };
        db.run_migrations().await?;
        Ok(db)
    }

    /// Opens or creates the database at the given path on disk.
    ///
    /// The path is passed as a file name (not a URL), so `?`, `#`, `%` and names
    /// outside UTF-8 work correctly.
    pub async fn open(path: impl AsRef<Path>) -> Result<Self, StorageError> {
        let path = path.as_ref();
        let opts = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
            .busy_timeout(std::time::Duration::from_secs(15));

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(Self::with_performance_pragmas(opts))
            .await?;

        let db = Self { pool };
        db.run_migrations().await?;
        info!("SQLite database initialised: {}", path.display());
        Ok(db)
    }

    /// Returns a reference to the internal SQLite connection pool.
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}
