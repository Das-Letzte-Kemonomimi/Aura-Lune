//! Shared error type for Tauri commands.
//!
//! Every command returns `Result<T, CommandError>`. The error serialises to the frontend as
//! `{ "code": "not_found", "message": "…" }`; the frontend (`src/api/ipc.ts`) turns it into
//! an `IpcError`, so it can react to the error category instead of the message text.
//!
//! The `From` conversions allow `?` directly on domain crate errors,
//! instead of `.map_err(|e| e.to_string())`.

use serde::Serialize;

/// Error category visible to the frontend (`IpcErrorCode` in `src/api/ipc.ts`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    /// SQLite database.
    Storage,
    /// Audio engine / GStreamer / analysis.
    Engine,
    /// File system.
    Io,
    /// Missing track, file, sound card and so on.
    NotFound,
    /// Invalid input from the user or the frontend.
    Validation,
    /// Network services (MusicBrainz, Last.fm, ListenBrainz, model downloads).
    Network,
    /// Other internal errors.
    Internal,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, thiserror::Error)]
#[error("{message}")]
pub struct CommandError {
    pub code: ErrorCode,
    pub message: String,
}

/// Shorthand for command signatures.
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

    /// Prefixes the message with the operation context, keeping the error category.
    pub fn context(mut self, context: impl std::fmt::Display) -> Self {
        self.message = format!("{context}: {}", self.message);
        self
    }
}

/// Text messages without an explicit category (e.g. `format!(…)` with context).
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
        Self::validation(format!("Invalid JSON data: {e}"))
    }
}

impl From<tauri::Error> for CommandError {
    fn from(e: tauri::Error) -> Self {
        Self::internal(e.to_string())
    }
}

impl From<tokio::task::JoinError> for CommandError {
    fn from(e: tokio::task::JoinError) -> Self {
        Self::internal(format!("Background task failed: {e}"))
    }
}

impl From<dsp_api::DspError> for CommandError {
    fn from(e: dsp_api::DspError) -> Self {
        Self::validation(e.to_string())
    }
}
