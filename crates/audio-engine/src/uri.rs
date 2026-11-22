//! Konwersja ścieżek plików na poprawnie zakodowane URI dla GStreamera (`uridecodebin`).
//!
//! Ścieżki ze spacjami, znakami spoza ASCII (np. japońskie tytuły) lub `%` muszą być
//! percent-encodowane. Gotowe URI `file://` są dekodowane i kodowane ponownie, co chroni
//! przed podwójnym kodowaniem (`%20` → `%2520`).

use crate::AudioEngineError;
use std::path::{Path, PathBuf};

/// Czy wejście to strumień sieciowy (przekazywany bez zmian).
fn is_network_uri(s: &str) -> bool {
    s.starts_with("http://") || s.starts_with("https://")
}

/// Koduje ścieżkę jako URI `file://`, kanonizując ją, jeśli to możliwe.
fn path_to_uri(path: &Path) -> String {
    let path: PathBuf = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    glib::filename_to_uri(&path, None)
        .map(|u| u.to_string())
        .unwrap_or_else(|_| format!("file://{}", path.display()))
}

/// Zamienia ścieżkę lub URI na URI odtwarzalne przez GStreamera. Nie sprawdza istnienia pliku.
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

/// Jak [`media_uri`], ale zwykła ścieżka (bez schematu) musi wskazywać istniejący plik.
pub fn media_uri_checked(uri_or_path: &str) -> Result<String, AudioEngineError> {
    let is_plain_path = !is_network_uri(uri_or_path) && !uri_or_path.starts_with("file://");
    if is_plain_path && !Path::new(uri_or_path).exists() {
        return Err(AudioEngineError::FileNotFound(uri_or_path.to_string()));
    }
    Ok(media_uri(uri_or_path))
}

/// Zamienia URI `file://` (z dekodowaniem `%XX`) lub zwykłą ścieżkę na ścieżkę lokalną.
/// Dla strumieni sieciowych zwraca wejście bez zmian (taka ścieżka nie istnieje na dysku).
pub fn local_path(uri_or_path: &str) -> PathBuf {
    if uri_or_path.starts_with("file://") {
        if let Ok((path, _)) = glib::filename_from_uri(uri_or_path) {
            return path;
        }
    }
    PathBuf::from(uri_or_path)
}
