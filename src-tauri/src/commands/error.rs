//! Wspólny typ błędu komend Tauri.
//!
//! Każda komenda zwraca `Result<T, CommandError>`. Błąd serializuje się do frontendu jako
//! `{ "code": "not_found", "message": "…" }`; frontend (`src/api/ipc.ts`) zamienia go na
//! `IpcError`, dzięki czemu może reagować na kategorię błędu zamiast na treść komunikatu.
//!
//! Konwersje `From` pozwalają używać `?` bezpośrednio na błędach crate'ów domenowych —
//! zamiast `.map_err(|e| e.to_string())`.

use serde::Serialize;

/// Kategoria błędu widoczna dla frontendu (`IpcErrorCode` w `src/api/ipc.ts`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    /// Baza danych SQLite.
    Storage,
    /// Silnik audio / GStreamer / analiza.
    Engine,
    /// System plików.
    Io,
    /// Brak utworu, pliku, karty dźwiękowej itp.
    NotFound,
    /// Nieprawidłowe dane wejściowe od użytkownika lub frontendu.
    Validation,
    /// Usługi sieciowe (MusicBrainz, Last.fm, ListenBrainz, pobieranie modeli).
    Network,
    /// Pozostałe błędy wewnętrzne.
    Internal,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, thiserror::Error)]
#[error("{message}")]
pub struct CommandError {
    pub code: ErrorCode,
    pub message: String,
}

/// Skrót dla sygnatur komend.
pub type CommandResult<T> = Result<T, CommandError>;

impl CommandError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::NotFound, message)
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Validation, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Internal, message)
    }

    /// Poprzedza komunikat kontekstem operacji, zachowując kategorię błędu.
    pub fn context(mut self, context: impl std::fmt::Display) -> Self {
        self.message = format!("{context}: {}", self.message);
        self
    }
}

/// Komunikaty tekstowe bez jawnej kategorii (np. `format!(…)` z kontekstem).
impl From<String> for CommandError {
    fn from(message: String) -> Self {
        Self::internal(message)
    }
}

impl From<&str> for CommandError {
    fn from(message: &str) -> Self {
        Self::internal(message)
    }
}

impl From<std::io::Error> for CommandError {
    fn from(e: std::io::Error) -> Self {
        let code = match e.kind() {
            std::io::ErrorKind::NotFound => ErrorCode::NotFound,
            _ => ErrorCode::Io,
        };
        Self::new(code, e.to_string())
    }
}

impl From<storage::StorageError> for CommandError {
    fn from(e: storage::StorageError) -> Self {
        let code = match &e {
            storage::StorageError::Domain(_) => ErrorCode::Validation,
            _ => ErrorCode::Storage,
        };
        Self::new(code, e.to_string())
    }
}

impl From<domain::DomainError> for CommandError {
    fn from(e: domain::DomainError) -> Self {
        Self::validation(e.to_string())
    }
}

impl From<audio_engine::AudioEngineError> for CommandError {
    fn from(e: audio_engine::AudioEngineError) -> Self {
        use audio_engine::AudioEngineError as E;
        let code = match &e {
            E::FileNotFound(_) | E::NotFound(_) => ErrorCode::NotFound,
            E::Validation(_) => ErrorCode::Validation,
            E::Io(io) if io.kind() == std::io::ErrorKind::NotFound => ErrorCode::NotFound,
            E::Io(_) => ErrorCode::Io,
            _ => ErrorCode::Engine,
        };
        Self::new(code, e.to_string())
    }
}

impl From<audio_engine::AnalysisError> for CommandError {
    fn from(e: audio_engine::AnalysisError) -> Self {
        use audio_engine::AnalysisError as E;
        let code = match &e {
            E::FileNotFound(_) => ErrorCode::NotFound,
            E::Io(_) | E::Tags(_) => ErrorCode::Io,
            E::Pipeline(_) => ErrorCode::Engine,
        };
        Self::new(code, e.to_string())
    }
}

impl From<audio_engine::TagError> for CommandError {
    fn from(e: audio_engine::TagError) -> Self {
        Self::new(ErrorCode::Io, e.to_string())
    }
}

impl From<metadata::ScrobbleError> for CommandError {
    fn from(e: metadata::ScrobbleError) -> Self {
        let code = match &e {
            metadata::ScrobbleError::Validation(_) => ErrorCode::Validation,
            _ => ErrorCode::Network,
        };
        Self::new(code, e.to_string())
    }
}

impl From<metadata::MetadataError> for CommandError {
    fn from(e: metadata::MetadataError) -> Self {
        let code = match &e {
            metadata::MetadataError::Io(_) => ErrorCode::Io,
            metadata::MetadataError::CoverNotFound(_) => ErrorCode::NotFound,
            _ => ErrorCode::Network,
        };
        Self::new(code, e.to_string())
    }
}

impl From<downloads::DownloadError> for CommandError {
    fn from(e: downloads::DownloadError) -> Self {
        use downloads::DownloadError as E;
        let code = match &e {
            E::Io(_) => ErrorCode::Io,
            E::PathTraversal(_) | E::UnsupportedUrl(_) => ErrorCode::Validation,
            E::Network(_) | E::ChecksumMismatch { .. } => ErrorCode::Network,
            E::Cancelled | E::General(_) => ErrorCode::Internal,
        };
        Self::new(code, e.to_string())
    }
}

impl From<library::LibraryError> for CommandError {
    fn from(e: library::LibraryError) -> Self {
        match e {
            library::LibraryError::Storage(s) => s.into(),
            library::LibraryError::Io(io) => io.into(),
            other => Self::new(ErrorCode::Io, other.to_string()),
        }
    }
}

impl From<serde_json::Error> for CommandError {
    fn from(e: serde_json::Error) -> Self {
        Self::validation(format!("Nieprawidłowe dane JSON: {e}"))
    }
}

impl From<tauri::Error> for CommandError {
    fn from(e: tauri::Error) -> Self {
        Self::internal(e.to_string())
    }
}

impl From<tokio::task::JoinError> for CommandError {
    fn from(e: tokio::task::JoinError) -> Self {
        Self::internal(format!("Zadanie w tle zakończyło się błędem: {e}"))
    }
}

impl From<dsp_api::DspError> for CommandError {
    fn from(e: dsp_api::DspError) -> Self {
        Self::validation(e.to_string())
    }
}
