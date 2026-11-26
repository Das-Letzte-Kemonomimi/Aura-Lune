//! Safety rules for paths passed from the UI (pure functions, no I/O).
//!
//! The UI (WebView) can ask the backend to write or read a file at a given path.
//! These rules limit the damage if the UI code were compromised: a write cannot reach
//! system directories or hidden configuration files in the home directory
//! (e.g. `~/.bashrc`, `~/.ssh`, `~/.config/autostart`), and a read that returns contents
//! applies only to files with the expected extensions.

use crate::DomainError;
use std::path::{Component, Path};

/// System directories the app never writes to.
/// `/run/media` (mounted removable media with music) is allowed despite the `/run` prefix.
const SYSTEM_PREFIXES: &[&str] = &[
    "/etc", "/usr", "/bin", "/sbin", "/lib", "/lib32", "/lib64", "/boot", "/proc", "/sys", "/dev",
    "/root", "/var", "/opt", "/srv", "/run",
];
const ALLOWED_UNDER_SYSTEM: &[&str] = &["/run/media"];

/// App files the UI may never overwrite, even inside the app's data directory
/// (the library database and its WAL/SHM files).
const PROTECTED_FILE_PREFIXES: &[&str] = &["auralune_library.db"];

/// Checks whether `path` is an allowed write target.
///
/// - the path must be absolute and must not contain `..`,
/// - it must not overwrite protected app files (the library database),
/// - it must not lie in a system directory ([`SYSTEM_PREFIXES`]),
/// - inside the `home` directory it must not touch a hidden entry (`~/.anything/...`),
///   unless it lies in one of the `allowed_roots` (e.g. the app's data directory).
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
    let protected = path
        .file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|name| PROTECTED_FILE_PREFIXES.iter().any(|p| name.starts_with(p)));
    if protected {
        return Err(invalid(
            path,
            "overwriting application data files is not allowed",
        ));
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

/// Whether the file extension (case-insensitive) is one of `allowed`.
pub fn has_allowed_extension(path: &Path, allowed: &[&str]) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|ext| allowed.iter().any(|a| a.eq_ignore_ascii_case(ext)))
}

/// Whether an identifier (e.g. a MusicBrainz MBID) is safe as part of a file name:
/// only letters, digits, `-` and `_`, non-empty, of reasonable length.
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

/// Audio file extensions the app reads, tags and plays from disk.
pub const AUDIO_EXTENSIONS: &[&str] = &[
    "flac", "mp3", "ogg", "opus", "wav", "m4a", "aac", "alac", "aiff", "aif", "wv", "ape",
];
