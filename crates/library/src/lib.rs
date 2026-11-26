//! Local music library management and the scanner.

pub mod scanner;

pub use scanner::{find_folder_cover, LibraryError, LibraryScanner, ScanSummary};
