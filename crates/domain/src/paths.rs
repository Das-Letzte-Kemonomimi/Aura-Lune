//! Zasady bezpieczeństwa ścieżek przekazywanych z interfejsu (czyste funkcje, bez I/O).
//!
//! Interfejs (WebView) może poprosić backend o zapis lub odczyt pliku pod wskazaną ścieżką.
//! Te reguły ograniczają szkody, gdyby kod interfejsu został przejęty: zapis nie może trafić
//! do katalogów systemowych ani do ukrytych plików konfiguracyjnych w katalogu domowym
//! (np. `~/.bashrc`, `~/.ssh`, `~/.config/autostart`), a odczyt zwracający zawartość
//! dotyczy tylko plików o oczekiwanych rozszerzeniach.

use crate::DomainError;
use std::path::{Component, Path};

/// Katalogi systemowe, do których aplikacja nigdy nie zapisuje.
/// `/run/media` (montowane nośniki wymienne z muzyką) jest dozwolone mimo prefiksu `/run`.
const SYSTEM_PREFIXES: &[&str] = &[
    "/etc", "/usr", "/bin", "/sbin", "/lib", "/lib32", "/lib64", "/boot", "/proc", "/sys", "/dev",
    "/root", "/var", "/opt", "/srv", "/run",
];
const ALLOWED_UNDER_SYSTEM: &[&str] = &["/run/media"];

/// Sprawdza, czy `path` jest dozwolonym celem zapisu.
///
/// - ścieżka musi być absolutna i nie może zawierać `..`,
/// - nie może leżeć w katalogu systemowym ([`SYSTEM_PREFIXES`]),
/// - w katalogu domowym `home` nie może dotyczyć ukrytego wpisu (`~/.cokolwiek/...`),
///   chyba że leży w jednym z `allowed_roots` (np. katalog danych aplikacji).
pub fn check_write_target(
    path: &Path,
    home: Option<&Path>,
    allowed_roots: &[&Path],
) -> Result<(), DomainError> {
    if !path.is_absolute() {
        return Err(invalid(path, "path must be absolute"));
    }
    if path.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(invalid(path, "path must not contain '..'"));
    }
    if allowed_roots.iter().any(|root| path.starts_with(root)) {
        return Ok(());
    }
    let under_system = SYSTEM_PREFIXES.iter().any(|p| path.starts_with(p))
        && !ALLOWED_UNDER_SYSTEM.iter().any(|p| path.starts_with(p));
    if under_system {
        return Err(invalid(
            path,
            "writing to system directories is not allowed",
        ));
    }
    if let Some(home) = home {
        if let Ok(rel) = path.strip_prefix(home) {
            let hidden = rel
                .components()
                .next()
                .and_then(|c| c.as_os_str().to_str())
                .is_some_and(|first| first.starts_with('.'));
            if hidden {
                return Err(invalid(
                    path,
                    "writing to hidden files and configuration directories is not allowed",
                ));
            }
        }
    }
    Ok(())
}

/// Czy rozszerzenie pliku (bez względu na wielkość liter) należy do `allowed`.
pub fn has_allowed_extension(path: &Path, allowed: &[&str]) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|ext| allowed.iter().any(|a| a.eq_ignore_ascii_case(ext)))
}

/// Czy identyfikator (np. MBID z MusicBrainz) jest bezpieczny jako fragment nazwy pliku:
/// tylko litery, cyfry, `-` i `_`, niepusty, rozsądnej długości.
pub fn is_safe_file_token(token: &str) -> bool {
    !token.is_empty()
        && token.len() <= 128
        && token
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn invalid(path: &Path, reason: &str) -> DomainError {
    DomainError::Validation(format!("Path not allowed {}: {}", path.display(), reason))
}
