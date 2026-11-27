//! Validation of paths passed from the UI before files are written or read.
//!
//! The rules (without I/O) live in `domain::paths`; this adds symlink resolution,
//! so that e.g. a `cover.png` pointing at `~/.ssh/id_rsa` does not bypass the check.

use super::error::CommandError;
use std::path::{Path, PathBuf};

/// App identifier from `tauri.conf.json`: the app's data and cache directories.
const APP_IDENTIFIER: &str = "com.auralune.player";
/// Directory the audio engine uses for AI models and the stem cache.
const APP_DIR_NAME: &str = "auralune";

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

/// App directories where writing is always allowed (data, cache, models).
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
    // `auralune`: AI models and the stem cache (audio_engine::model_manager).
    .flat_map(|base| [base.join(APP_IDENTIFIER), base.join(APP_DIR_NAME)])
    .collect()
}

/// Resolves the symlinks of the nearest existing ancestor (the target file usually
/// does not exist yet) and appends the remaining components.
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

/// Checks a write target chosen by the UI (exports, rendering, downloads).
#[must_use = "write to the returned (resolved) path"]
pub fn ensure_writable(path: &Path) -> Result<PathBuf, CommandError> {
    let resolved = resolve_for_write(path);
    let roots = app_dirs();
    let roots: Vec<&Path> = roots.iter().map(PathBuf::as_path).collect();
    domain::paths::check_write_target(&resolved, home_dir().as_deref(), &roots)?;
    Ok(resolved)
}

/// Checks a file whose contents will be read at the UI's request: it must exist,
/// be a regular file and (after resolving links) have one of the `extensions`.
#[must_use = "read from the returned (resolved) path"]
pub fn ensure_readable(path: &Path, extensions: &[&str]) -> Result<PathBuf, CommandError> {
    let resolved = path
        .canonicalize()
        .map_err(|_| CommandError::not_found(format!("File does not exist: {}", path.display())))?;
    if !resolved.is_file() {
        return Err(CommandError::validation(format!(
            "Not a file: {}",
            path.display()
        )));
    }
    if !domain::paths::has_allowed_extension(&resolved, extensions) {
        return Err(CommandError::validation(format!(
            "Unsupported file type: {} (allowed: {})",
            path.display(),
            extensions.join(", ")
        )));
    }
    Ok(resolved)
}

/// Audio file extensions (the list shared with `domain::paths`).
pub use domain::paths::AUDIO_EXTENSIONS;

/// Image extensions for covers and wallpapers.
pub const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif"];
