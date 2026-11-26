//! Installing a downloaded update: download with SHA-256 verification (logic in `crates/downloads`),
//! atomic replacement of the AppImage file and a restart through the launcher.

use super::{UpdateAsset, UPDATE_PROGRESS_EVENT};
use crate::commands::error::CommandError;
use downloads::{DownloadProvider, HttpDownloadProvider};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// Minimum interval between progress events (ms), so the WebView is not flooded.
const PROGRESS_EMIT_INTERVAL_MS: u64 = 200;

/// Only https URLs belonging to GitHub are allowed (the releases page and the asset CDN).
pub fn validate_asset_url(url: &str) -> Result<(), CommandError> {
    let parsed =
        url::Url::parse(url).map_err(|_| CommandError::validation("Invalid update file URL"))?;
    let host = parsed.host_str().unwrap_or("");
    let allowed = ["github.com", "githubusercontent.com"]
        .iter()
        .any(|d| host == *d || host.ends_with(&format!(".{d}")));
    if parsed.scheme() != "https" || !allowed {
        return Err(CommandError::validation(
            "The update file URL must point to GitHub over https",
        ));
    }
    Ok(())
}

/// Path of the work file next to the target AppImage (same file system → atomic `rename`).
pub fn staging_path(target: &Path) -> PathBuf {
    let name = target
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("auralune.AppImage");
    target.with_file_name(format!("{name}.update"))
}

/// Whether the file starts with the ELF signature (a type 2 AppImage is an ELF file).
pub fn looks_like_appimage(path: &Path) -> bool {
    use std::io::Read;
    let mut magic = [0u8; 4];
    std::fs::File::open(path)
        .and_then(|mut f| f.read_exact(&mut magic))
        .is_ok()
        && magic == *b"\x7fELF"
}

/// Downloads `asset` with checksum verification and replaces `target`. The work file is removed on
/// every error; the running process keeps using the old file (the replacement is a `rename`).
pub async fn download_and_replace(
    app: &AppHandle,
    asset: &UpdateAsset,
    expected_sha256: &str,
    target: &Path,
) -> Result<(), CommandError> {
    validate_asset_url(&asset.url)?;
    let staging = staging_path(target);
    let _ = tokio::fs::remove_file(&staging).await;

    let started = std::time::Instant::now();
    let last_emit = Arc::new(AtomicU64::new(0));
    let progress_app = app.clone();
    let progress = Box::new(move |downloaded: u64, total: Option<u64>| {
        let elapsed = started.elapsed().as_millis() as u64;
        let finished = total.is_some_and(|t| downloaded >= t);
        let previous = last_emit.load(Ordering::Relaxed);
        if !finished && elapsed.saturating_sub(previous) < PROGRESS_EMIT_INTERVAL_MS {
            return;
        }
        last_emit.store(elapsed, Ordering::Relaxed);
        let _ = progress_app.emit(
            UPDATE_PROGRESS_EVENT,
            serde_json::json!({ "downloaded": downloaded, "total": total }),
        );
    });

    HttpDownloadProvider::new()
        .download(
            &asset.url,
            &staging,
            Some(expected_sha256),
            Arc::new(AtomicBool::new(false)),
            Some(progress),
        )
        .await?;

    let result = finalize(&staging, target).await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(&staging).await;
    }
    result
}

async fn finalize(staging: &Path, target: &Path) -> Result<(), CommandError> {
    let check_path = staging.to_path_buf();
    let valid = tokio::task::spawn_blocking(move || looks_like_appimage(&check_path)).await?;
    if !valid {
        return Err(CommandError::validation(
            "The downloaded file is not a valid AppImage",
        ));
    }
    use std::os::unix::fs::PermissionsExt;
    tokio::fs::set_permissions(staging, std::fs::Permissions::from_mode(0o755)).await?;
    tokio::fs::rename(staging, target)
        .await
        .map_err(|e| CommandError::from(e).context("Failed to replace the AppImage file"))
}

/// What to start the new version with: the `~/.local/bin/auralune{,-dev}` launcher (sets the channel and
/// handles missing FUSE), or as a last resort the AppImage itself.
pub fn restart_target(
    home: Option<&Path>,
    is_dev: bool,
    appimage: Option<&str>,
) -> Option<PathBuf> {
    let launcher = home
        .map(|h| {
            h.join(".local/bin")
                .join(if is_dev { "auralune-dev" } else { "auralune" })
        })
        .filter(|p| p.is_file());
    launcher.or_else(|| appimage.filter(|p| !p.is_empty()).map(PathBuf::from))
}

/// Starts a new instance in the background (in its own process group) after a short delay: only
/// after the current one quits is the `single-instance` lock released, otherwise the new process would reach
/// the still running old one and exit at once.
pub fn spawn_detached_restart(target: &Path, is_dev: bool) -> Result<(), CommandError> {
    use std::os::unix::process::CommandExt;
    let mut cmd = std::process::Command::new("sh");
    cmd.arg("-c")
        .arg("sleep 2; exec \"$0\"")
        .arg(target)
        .env("AURALUNE_CHANNEL", if is_dev { "dev" } else { "stable" })
        // The current AppImage's environment variables must not leak into the new one.
        .env_remove("APPDIR")
        .env_remove("APPIMAGE")
        .env_remove("ARGV0")
        .env_remove("OWD")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .process_group(0);
    cmd.spawn()
        .map(|_| ())
        .map_err(|e| CommandError::from(e).context("Failed to start the new version"))
}
