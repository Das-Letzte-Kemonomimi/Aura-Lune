//! Błędy warstwy domenowej (parsery formatów i walidacja modeli).

use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum DomainError {
    /// Nie udało się sparsować danych wejściowych (CUE, M3U, EqualizerAPO).
    #[error("{0}")]
    Parse(String),
    /// Dane są poprawne składniowo, ale łamią reguły domeny (motyw, wzorzec nazwy pliku).
    #[error("{0}")]
    Validation(String),
}
