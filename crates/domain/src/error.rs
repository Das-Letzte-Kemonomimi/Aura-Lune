//! Domain layer errors (format parsers and model validation).

use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum DomainError {
    /// The input could not be parsed (CUE, M3U, EqualizerAPO).
    #[error("{0}")]
    Parse(String),
    /// The data is syntactically valid but breaks a domain rule (theme, file name pattern).
    #[error("{0}")]
    Validation(String),
}
