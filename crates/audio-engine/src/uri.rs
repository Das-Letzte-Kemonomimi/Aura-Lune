//! Converts file paths into correctly encoded URIs for GStreamer (`uridecodebin`).
//!
//! Paths with spaces, non-ASCII characters (e.g. Japanese titles) or `%` must be
//! percent-encoded. Ready `file://` URIs are decoded and re-encoded, which prevents
//! double encoding (`%20` → `%2520`).

use crate::AudioEngineError;
use std::path::{Path, PathBuf};

/// Whether the input is a network stream (passed through unchanged).
fn is_network_uri(s: &str) -> bool {
    s.starts_with("http://") || s.starts_with("https://")
}

/// Encodes a path as a `file://` URI, canonicalising it when possible.
fn path_to_uri(path: &Path) -> String {
    let path: PathBuf = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    glib::filename_to_uri(&path, None)
        .map(|u| u.to_string())
        .unwrap_or_else(|_| format!("file://{}", path.display()))
}

/// Turns a path or URI into a URI GStreamer can play. Does not check that the file exists.
pub fn media_uri(uri_or_path: &str) -> String {
    if is_network_uri(uri_or_path) {
        return uri_or_path.to_string();
    }
    if uri_or_path.starts_with("file://") {
        return match glib::filename_from_uri(uri_or_path) {
            Ok((path, _)) => path_to_uri(&path),
            Err(_) => uri_or_path.to_string(),
        };
    }
    path_to_uri(Path::new(uri_or_path))
}

/// Like [`media_uri`], but a plain path (no scheme) must point to an existing file.
pub fn media_uri_checked(uri_or_path: &str) -> Result<String, AudioEngineError> {
    let is_plain_path = !is_network_uri(uri_or_path) && !uri_or_path.starts_with("file://");
    if is_plain_path && !Path::new(uri_or_path).exists() {
        return Err(AudioEngineError::FileNotFound(uri_or_path.to_string()));
    }
    Ok(media_uri(uri_or_path))
}

/// Turns a `file://` URI (decoding `%XX`) or a plain path into a local path.
/// For network streams the input is returned unchanged (such a path doesn't exist on disk).
pub fn local_path(uri_or_path: &str) -> PathBuf {
    if uri_or_path.starts_with("file://") {
        if let Ok((path, _)) = glib::filename_from_uri(uri_or_path) {
            return path;
        }
    }
    PathBuf::from(uri_or_path)
}
