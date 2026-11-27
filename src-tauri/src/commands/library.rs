//! Commands for managing the music library, indexing, statistics and track metadata.

use super::error::CommandError;
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use storage::{AlbumRecord, DuplicateGroup, RecapSummaryDto, TrackRecord};
use tauri::State;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummaryDto {
    pub total_files_found: usize,
    pub new_or_updated_tracks: usize,
    pub skipped_unchanged: usize,
    pub errors: usize,
}

/// Maximum size of a local cover file served to the UI.
const MAX_COVER_FILE_BYTES: u64 = 20 * 1024 * 1024;

/// Validated, size-limited local image file behind a path; `None` for bad paths or oversized files.
fn local_cover_file(path: &Path) -> Option<PathBuf> {
    let resolved = super::paths::ensure_readable(path, super::paths::IMAGE_EXTENSIONS).ok()?;
    if fs::metadata(&resolved).ok()?.len() > MAX_COVER_FILE_BYTES {
        return None;
    }
    Some(resolved)
}

/// Deterministic 64-bit FNV-1a hash used for I/O-free media cache-busting query versions.
pub fn fnv64(input: &str) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for &b in input.as_bytes() {
        hash ^= u64::from(b);
        hash = hash.wrapping_mul(0x100_0000_01b3);
    }
    hash
}

static THUMBNAIL_DISK_DIR: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();

/// Configures the persistent on-disk directory used to cache resized JPEG thumbnails.
pub fn init_thumbnail_cache_dir(dir: PathBuf) {
    let _ = THUMBNAIL_DISK_DIR.set(dir);
}

fn thumbnail_disk_path(
    path: &Path,
    edge: u32,
    size: u64,
    mtime: std::time::SystemTime,
) -> Option<PathBuf> {
    let dir = THUMBNAIL_DISK_DIR.get()?;
    let mtime_secs = mtime
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Deterministic 128-bit FNV-1a fingerprint so thumbnails survive restarts.
    let mut h1: u64 = 0xcbf2_9ce4_8422_2325;
    let mut h2: u64 = 0xaf63_bd4c_8601_b7df;
    for &b in path
        .to_string_lossy()
        .as_bytes()
        .iter()
        .chain(edge.to_le_bytes().iter())
        .chain(size.to_le_bytes().iter())
        .chain(mtime_secs.to_le_bytes().iter())
    {
        h1 ^= u64::from(b);
        h1 = h1.wrapping_mul(0x100_0000_01b3);
        h2 = h2.wrapping_mul(0x100_0000_01b3) ^ u64::from(b);
    }
    Some(dir.join(format!("{h1:016x}{h2:016x}.jpg")))
}

/// Downscales image bytes into a JPEG payload fit within `edge x edge`.
fn thumbnail_jpeg_bytes(bytes: &[u8], edge: u32) -> Option<Vec<u8>> {
    let image = image::load_from_memory(bytes).ok()?;
    let thumb = image.thumbnail(edge, edge).to_rgb8();
    let mut jpeg = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 85)
        .encode_image(&thumb)
        .ok()?;
    Some(jpeg)
}

fn write_thumbnail_atomically(disk_path: &Path, jpeg: &[u8]) {
    if let Some(parent) = disk_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let tmp = disk_path.with_extension("tmp");
    if fs::write(&tmp, jpeg).is_ok() {
        let _ = fs::rename(&tmp, disk_path);
    }
}

/// Returns the on-disk cached JPEG thumbnail for `src` downscaled to `edge` pixels,
/// generating it on miss. Falls back to the validated original file if image decoding fails.
pub fn thumbnail_file(src: &Path, edge: u32) -> Option<PathBuf> {
    let path = local_cover_file(src)?;
    let meta = fs::metadata(&path).ok()?;
    let mtime = meta.modified().ok()?;
    let disk_path = thumbnail_disk_path(&path, edge, meta.len(), mtime);

    if let Some(dp) = disk_path.as_ref().filter(|p| p.exists()) {
        return Some(dp.clone());
    }

    let bytes = fs::read(&path).ok()?;
    if let Some(jpeg) = thumbnail_jpeg_bytes(&bytes, edge) {
        if let Some(dp) = disk_path {
            write_thumbnail_atomically(&dp, &jpeg);
            if dp.exists() {
                return Some(dp);
            }
        }
        // Fallback when THUMBNAIL_DISK_DIR is not configured (e.g., isolated unit tests).
        let temp_dp = std::env::temp_dir().join(format!(
            "auralune_thumb_{}_{}.jpg",
            edge,
            fnv64(&path.to_string_lossy())
        ));
        write_thumbnail_atomically(&temp_dp, &jpeg);
        return temp_dp.exists().then_some(temp_dp);
    }

    Some(path)
}

/// Resolves embedded tag art (using `read_cover_art(true)`) or folder cover for an audio track,
/// returning a downscaled cached JPEG thumbnail path fit within `edge` pixels.
pub fn thumbnail_for_audio(audio_path: &Path, edge: u32) -> Option<PathBuf> {
    use lofty::file::TaggedFileExt;

    let resolved =
        super::paths::ensure_readable(audio_path, super::paths::AUDIO_EXTENSIONS).ok()?;
    let meta = fs::metadata(&resolved).ok()?;
    let mtime = meta.modified().ok()?;
    let disk_path = thumbnail_disk_path(&resolved, edge, meta.len(), mtime);

    if let Some(dp) = disk_path.as_ref().filter(|p| p.exists()) {
        return Some(dp.clone());
    }

    let parse_opts = lofty::config::ParseOptions::new()
        .read_cover_art(true)
        .read_properties(false);
    if let Ok(probe) = lofty::probe::Probe::open(&resolved) {
        if let Ok(tagged_file) = probe.options(parse_opts).read() {
            if let Some(pic) = tagged_file
                .primary_tag()
                .or_else(|| tagged_file.first_tag())
                .and_then(|tag| tag.pictures().first())
            {
                if let Some(jpeg) = thumbnail_jpeg_bytes(pic.data(), edge) {
                    if let Some(dp) = disk_path {
                        write_thumbnail_atomically(&dp, &jpeg);
                        if dp.exists() {
                            return Some(dp);
                        }
                    }
                    let temp_dp = std::env::temp_dir().join(format!(
                        "auralune_audio_thumb_{}_{}.jpg",
                        edge,
                        fnv64(&resolved.to_string_lossy())
                    ));
                    write_thumbnail_atomically(&temp_dp, &jpeg);
                    return temp_dp.exists().then_some(temp_dp);
                }
            }
        }
    }

    resolved
        .parent()
        .and_then(|parent| library::find_folder_cover(parent, None))
        .and_then(|cand| thumbnail_file(&cand, edge))
}

/// Encodes image bytes as `data:<mime>;base64,…` (MIME type from the extension).
/// Used only by portable theme/profile exports.
pub fn image_data_uri(extension: &str, bytes: &[u8]) -> String {
    let mime = match extension.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/jpeg",
    };
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:{mime};base64,{b64}")
}

/// Performs recursive library scan over the specified folder.
pub async fn scan_library_internal(
    state: &AppState,
    folder_path: &str,
) -> Result<ScanSummaryDto, CommandError> {
    if folder_path.trim().is_empty() {
        return Err(CommandError::validation("The scan path must not be empty"));
    }

    info!("Library scan started for: {}", folder_path);
    let summary = state.scanner.scan_directory(folder_path, &state.db).await?;
    state.cover_worker_notify.notify_one();

    Ok(ScanSummaryDto {
        total_files_found: summary.total_files_found,
        new_or_updated_tracks: summary.new_or_updated_tracks,
        skipped_unchanged: summary.skipped_unchanged,
        errors: summary.errors,
    })
}

/// Scans specific paths (files or folders) and inserts or updates metadata in DB.
pub async fn scan_paths_internal(
    state: &AppState,
    paths: &[String],
) -> Result<ScanSummaryDto, CommandError> {
    if paths.is_empty() {
        return Ok(ScanSummaryDto {
            total_files_found: 0,
            new_or_updated_tracks: 0,
            skipped_unchanged: 0,
            errors: 0,
        });
    }

    info!("Scanning {} specific paths", paths.len());
    let path_bufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    let summary = state.scanner.scan_paths(&path_bufs, &state.db).await?;
    state.cover_worker_notify.notify_one();

    Ok(ScanSummaryDto {
        total_files_found: summary.total_files_found,
        new_or_updated_tracks: summary.new_or_updated_tracks,
        skipped_unchanged: summary.skipped_unchanged,
        errors: summary.errors,
    })
}

/// Retrieves all indexed tracks from the database.
pub async fn get_library_tracks_internal(
    state: &AppState,
) -> Result<Vec<TrackRecord>, CommandError> {
    state.db.list_tracks().await.map_err(CommandError::from)
}

#[tauri::command]
pub async fn scan_library(
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<ScanSummaryDto, CommandError> {
    scan_library_internal(&state, &folder_path).await
}

#[tauri::command]
pub async fn scan_paths(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<ScanSummaryDto, CommandError> {
    scan_paths_internal(&state, &paths).await
}

#[tauri::command]
pub async fn get_library_tracks(
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, CommandError> {
    get_library_tracks_internal(&state).await
}

#[tauri::command]
pub async fn get_library_albums(
    state: State<'_, AppState>,
) -> Result<Vec<AlbumRecord>, CommandError> {
    let started = std::time::Instant::now();
    let mut albums = state.db.list_albums().await?;
    for album in &mut albums {
        album.cover_path = album
            .cover_path
            .as_deref()
            .and_then(|cp| crate::media_protocol::album_cover_url_opt(album.id, cp));
    }
    info!(
        "get_library_albums mapped {} albums in {:?}",
        albums.len(),
        started.elapsed()
    );
    Ok(albums)
}

#[tauri::command]
pub async fn toggle_favorite(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<bool, CommandError> {
    state
        .db
        .toggle_favorite(track_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn set_track_rating(
    track_id: i64,
    rating: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .set_track_rating(track_id, rating)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn record_track_play(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .record_track_play(track_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_recap_summary(
    period: String,
    state: State<'_, AppState>,
) -> Result<RecapSummaryDto, CommandError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let since_epoch = match period.as_str() {
        "week" => now.saturating_sub(7 * 86400),
        "month" => now.saturating_sub(30 * 86400),
        "year" => now.saturating_sub(365 * 86400),
        _ => 0, // all_time
    };

    state
        .db
        .get_recap_summary(&period, since_epoch)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn reset_track_plays(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state
        .db
        .reset_track_plays(track_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn find_duplicate_tracks(
    state: State<'_, AppState>,
) -> Result<Vec<DuplicateGroup>, CommandError> {
    state
        .db
        .find_duplicate_tracks()
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn delete_track_record(
    track_id: i64,
    delete_file: bool,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    if delete_file {
        if let Some(track) = state.db.get_track_by_id(track_id).await? {
            // Delete the record only after the file was deleted, otherwise the UI would report
            // success while the file stays on disk (and comes back on the next scan).
            let p = audio_engine::uri::local_path(&track.path);
            match tokio::fs::remove_file(&p).await {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => {
                    return Err(CommandError::from(e)
                        .context(format!("Failed to delete the file {}", p.display())));
                }
            }
        }
    }
    state
        .db
        .delete_track(track_id)
        .await
        .map_err(CommandError::from)
}
