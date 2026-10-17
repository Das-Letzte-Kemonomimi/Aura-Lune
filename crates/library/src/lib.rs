//! Moduł zarządzania lokalną biblioteką muzyczną i skanerem.

pub mod scanner;

pub use scanner::{LibraryError, LibraryScanner, ScanSummary};
