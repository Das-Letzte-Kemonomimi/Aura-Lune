//! Walidacja ścieżek przekazywanych z interfejsu przed zapisem lub odczytem plików.
//!
//! Reguły (bez I/O) są w `domain::paths`; tutaj dochodzi rozwiązanie dowiązań symbolicznych,
//! aby np. `cover.png` wskazujący na `~/.ssh/id_rsa` nie ominął sprawdzenia.

use super::error::CommandError;
use std::path::{Path, PathBuf};

/// Identyfikator aplikacji z `tauri.conf.json` — katalogi danych i cache aplikacji.
const APP_IDENTIFIER: &str = "com.auralune.player";
/// Katalog używany przez silnik audio dla modeli AI i cache stemów.
const APP_DIR_NAME: &str = "auralune";

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

/// Katalogi aplikacji, w których zapis jest zawsze dozwolony (dane, cache, modele).
pub fn app_dirs() -> Vec<PathBuf> {
    let home = home_dir();
    let xdg = |var: &str, fallback: &str| {
        std::env::var_os(var)
            .map(PathBuf::from)
            .or_else(|| home.as_ref().map(|h| h.join(fallback)))
    };
    [
        xdg("XDG_DATA_HOME", ".local/share"),
        xdg("XDG_CACHE_HOME", ".cache"),
        xdg("XDG_CONFIG_HOME", ".config"),
    ]
    .into_iter()
    .flatten()
    // `auralune` — modele AI i cache stemów (audio_engine::model_manager).
    .flat_map(|base| [base.join(APP_IDENTIFIER), base.join(APP_DIR_NAME)])
    .collect()
}

/// Rozwiązuje dowiązania symboliczne najbliższego istniejącego przodka (plik docelowy
/// zwykle jeszcze nie istnieje) i dokleja pozostałe składniki.
fn resolve_for_write(path: &Path) -> PathBuf {
    let mut existing = path;
    let mut rest = Vec::new();
    while !existing.exists() {
        match (existing.parent(), existing.file_name()) {
            (Some(parent), Some(name)) => {
                rest.push(name.to_owned());
                existing = parent;
            }
            _ => return path.to_path_buf(),
        }
    }
    let mut resolved = existing
        .canonicalize()
        .unwrap_or_else(|_| existing.to_path_buf());
    for part in rest.into_iter().rev() {
        resolved.push(part);
    }
    resolved
}

/// Sprawdza cel zapisu wskazany przez interfejs (eksporty, renderowanie, pobieranie).
pub fn ensure_writable(path: &Path) -> Result<PathBuf, CommandError> {
    let resolved = resolve_for_write(path);
    let roots = app_dirs();
    let roots: Vec<&Path> = roots.iter().map(PathBuf::as_path).collect();
    domain::paths::check_write_target(&resolved, home_dir().as_deref(), &roots)?;
    Ok(resolved)
}

/// Sprawdza plik, którego zawartość zostanie odczytana na żądanie interfejsu: musi istnieć,
/// być zwykłym plikiem i (po rozwiązaniu dowiązań) mieć jedno z `extensions`.
pub fn ensure_readable(path: &Path, extensions: &[&str]) -> Result<PathBuf, CommandError> {
    let resolved = path
        .canonicalize()
        .map_err(|_| CommandError::not_found(format!("Plik nie istnieje: {}", path.display())))?;
    if !resolved.is_file() {
        return Err(CommandError::validation(format!(
            "To nie jest plik: {}",
            path.display()
        )));
    }
    if !domain::paths::has_allowed_extension(&resolved, extensions) {
        return Err(CommandError::validation(format!(
            "Nieobsługiwany typ pliku: {} (dozwolone: {})",
            path.display(),
            extensions.join(", ")
        )));
    }
    Ok(resolved)
}
