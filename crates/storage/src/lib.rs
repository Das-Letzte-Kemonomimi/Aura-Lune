//! Moduł pamięci trwałej i bazy SQLite (sqlx).
//!
//! Zdekomponowana i modularna warstwa persystencji danych Aura-Lune:
//! - [`models`]: Struktury DTO, encje bazodanowe i błędy [`StorageError`].
//! - [`schema`]: Migracje SQLite, schematy tabel, indeksy i domyślne motywy.
//! - [`library`]: Zarządzanie artystami, albumami, utworami i wykrywaniem duplikatów.
//! - [`bookmarks`]: Zakładki odtwarzania oraz wielopunktowe znaczniki (cue points).
//! - [`settings`]: Ustawienia aplikacji, motywy graficzne i presety DSP.
//! - [`playlists`]: Playlisty użytkowniczki oraz stan kolejki odtwarzania.
//! - [`stats`]: Statystyki odsłuchów, historia, inteligentne zapytania i roczne/okresowe Recap.
//! - [`analysis`]: Wyniki analizy muzycznej (akordy, transkrypcja, punkty szczytowe fali, modele AI).
//! - [`stems`]: Wyniki separacji stemów oraz wielościeżkowe projekty miksów (Moises-like).

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

/// Główny interfejs bazy danych SQLite.
#[derive(Clone)]
pub struct Database {
    pub(crate) pool: SqlitePool,
}

impl Database {
    /// Pragmy wydajnościowe stosowane do **każdego** połączenia puli (są per-połączenie):
    /// pamięć podręczna 64 MB, tabele tymczasowe w RAM, mmap 256 MB.
    fn with_performance_pragmas(opts: SqliteConnectOptions) -> SqliteConnectOptions {
        opts.pragma("temp_store", "MEMORY")
            .pragma("cache_size", "-64000")
            .pragma("mmap_size", "268435456")
    }

    /// Tworzy bazę danych w pamięci RAM (przydatne do testów i sesji ulotnych).
    ///
    /// Każde połączenie `sqlite::memory:` to osobna, pusta baza — pula ma więc dokładnie
    /// jedno połączenie, inaczej zapytania mogłyby trafić do bazy bez schematu.
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

    /// Otwiera lub tworzy bazę danych w podanej ścieżce na dysku.
    ///
    /// Ścieżka jest przekazywana jako nazwa pliku (nie URL), więc `?`, `#`, `%` i nazwy
    /// spoza UTF-8 działają poprawnie.
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
        info!("Baza danych SQLite zainicjalizowana: {}", path.display());
        Ok(db)
    }

    /// Zwraca referencję do wewnętrznej puli połączeń SQLite.
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}
