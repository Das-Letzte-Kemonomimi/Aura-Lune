//! Custom `auralune-media` URI scheme protocol for serving covers and theme wallpapers.
//!
//! URLs carry only database IDs or SHA-256 content hashes (never filesystem paths):
//! - `auralune-media://localhost/cover/album/{album_id}?s={256|768}&v={ver}`
//! - `auralune-media://localhost/cover/track/{track_id}?s={256|768}&v={ver}`
//! - `auralune-media://localhost/cover/current?s={256|768}&v={ver}`
//! - `auralune-media://localhost/bg/{sha256}.{ext}`

use crate::commands::library::{fnv64, thumbnail_file, thumbnail_for_audio};
use crate::AppState;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{OnceLock, RwLock};
use tauri::http::{header, Request, Response, StatusCode};
use tauri::{Manager, Runtime, UriSchemeContext, UriSchemeResponder};
use tracing::debug;

pub const MEDIA_SCHEME: &str = "auralune-media";
pub const MEDIA_HOST: &str = "localhost";
pub const DEFAULT_COVER_SIZE: u32 = 256;
pub const LARGE_COVER_SIZE: u32 = 768;

const CACHE_CONTROL_IMMUTABLE: &str = "public, max-age=31536000, immutable";
const BACKGROUND_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "mp4", "webm"];

static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();
static COVER_GENERATIONS: OnceLock<RwLock<HashMap<i64, u64>>> = OnceLock::new();
static NEXT_COVER_GEN: AtomicU64 = AtomicU64::new(1);

/// Records the resolved app data directory so protocol handlers can locate `backgrounds/`.
pub fn init_app_data_dir(dir: PathBuf) {
    let _ = APP_DATA_DIR.set(dir);
}

/// Directory storing content-addressed wallpaper images and videos.
pub fn backgrounds_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("backgrounds")
}

/// Bumps the session cache-buster generation for an album whose cover file was overwritten.
pub fn bump_album_cover_version(album_id: i64) -> u64 {
    let gen = NEXT_COVER_GEN.fetch_add(1, Ordering::Relaxed);
    let map = COVER_GENERATIONS.get_or_init(Default::default);
    if let Ok(mut guard) = map.write() {
        guard.insert(album_id, gen);
    }
    gen
}

fn current_album_generation(album_id: i64) -> Option<u64> {
    let map = COVER_GENERATIONS.get()?;
    map.read().ok()?.get(&album_id).copied()
}

/// Builds an I/O-free media URL (or passes through an HTTP(S) URL) for an album cover.
pub fn album_cover_url(album_id: i64, cover_path: &str) -> String {
    if cover_path.starts_with("http://") || cover_path.starts_with("https://") {
        return cover_path.to_string();
    }
    let hash = fnv64(cover_path);
    match current_album_generation(album_id) {
        Some(gen) => {
            format!("{MEDIA_SCHEME}://{MEDIA_HOST}/cover/album/{album_id}?s={DEFAULT_COVER_SIZE}&v={hash:016x}-{gen}")
        }
        None => {
            format!("{MEDIA_SCHEME}://{MEDIA_HOST}/cover/album/{album_id}?s={DEFAULT_COVER_SIZE}&v={hash:016x}")
        }
    }
}

/// Optional wrapper around [`album_cover_url`] that filters empty DB strings.
pub fn album_cover_url_opt(album_id: i64, cover_path: &str) -> Option<String> {
    if cover_path.trim().is_empty() {
        None
    } else {
        Some(album_cover_url(album_id, cover_path))
    }
}

/// Builds a media URL for a library track's embedded or folder artwork.
pub fn track_cover_url(track_id: i64, version: &str) -> String {
    format!(
        "{MEDIA_SCHEME}://{MEDIA_HOST}/cover/track/{track_id}?s={DEFAULT_COVER_SIZE}&v={version}"
    )
}

/// Builds a media URL for the audio engine's currently loaded non-library track artwork.
pub fn current_cover_url(version: &str) -> String {
    format!("{MEDIA_SCHEME}://{MEDIA_HOST}/cover/current?s={DEFAULT_COVER_SIZE}&v={version}")
}

/// Builds a media URL for a content-addressed background file in `app_data/backgrounds/`.
pub fn background_url(file_name: &str) -> String {
    format!("{MEDIA_SCHEME}://{MEDIA_HOST}/bg/{file_name}")
}

/// Parsed route targets accepted by the `auralune-media` protocol.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MediaRoute {
    AlbumCover { album_id: i64, size: u32 },
    TrackCover { track_id: i64, size: u32 },
    CurrentCover { size: u32 },
    Background { file_name: String },
}

/// Inclusive HTTP byte range `[start, end]`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ByteRange {
    pub start: u64,
    pub end: u64,
}

fn parse_cover_size(query: Option<&str>) -> Option<u32> {
    let Some(q) = query else {
        return Some(DEFAULT_COVER_SIZE);
    };
    for pair in q.split('&') {
        if pair.is_empty() {
            continue;
        }
        let (key, val) = pair.split_once('=').unwrap_or((pair, ""));
        if key == "s" {
            return match val {
                "256" => Some(256),
                "768" => Some(768),
                _ => None,
            };
        }
    }
    Some(DEFAULT_COVER_SIZE)
}

fn is_valid_bg_filename(name: &str) -> bool {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return false;
    }
    let Some((stem, ext)) = name.split_once('.') else {
        return false;
    };
    // Single extension only, safe token stem, allow-listed image/video format.
    !ext.contains('.')
        && domain::paths::is_safe_file_token(stem)
        && BACKGROUND_EXTENSIONS
            .iter()
            .any(|allowed| allowed.eq_ignore_ascii_case(ext))
}

/// Pure route parser for `auralune-media://localhost/...` or `/path?query` URIs.
pub fn parse_media_route(raw: &str) -> Option<MediaRoute> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.contains('\\') || trimmed.contains("..") {
        return None;
    }

    let path_and_query = if let Some(rest) = trimmed.strip_prefix(&format!("{MEDIA_SCHEME}://")) {
        let (_, path_part) = rest.split_once('/')?;
        path_part
    } else {
        trimmed.trim_start_matches('/')
    };

    let (path, query) = match path_and_query.split_once('?') {
        Some((p, q)) => (p, Some(q)),
        None => (path_and_query, None),
    };

    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    match segments.as_slice() {
        ["cover", "album", id_str] => {
            let album_id = id_str.parse::<i64>().ok().filter(|&id| id > 0)?;
            let size = parse_cover_size(query)?;
            Some(MediaRoute::AlbumCover { album_id, size })
        }
        ["cover", "track", id_str] => {
            let track_id = id_str.parse::<i64>().ok().filter(|&id| id > 0)?;
            let size = parse_cover_size(query)?;
            Some(MediaRoute::TrackCover { track_id, size })
        }
        ["cover", "current"] => {
            let size = parse_cover_size(query)?;
            Some(MediaRoute::CurrentCover { size })
        }
        ["bg", file_name] => {
            if !is_valid_bg_filename(file_name) {
                return None;
            }
            Some(MediaRoute::Background {
                file_name: (*file_name).to_string(),
            })
        }
        _ => None,
    }
}

/// Parses an HTTP `Range: bytes=...` header against a file of `total_len` bytes.
pub fn parse_range(header_val: &str, total_len: u64) -> Option<ByteRange> {
    if total_len == 0 {
        return None;
    }
    let spec = header_val.trim().strip_prefix("bytes=")?.trim();
    if spec.is_empty() || spec.contains(',') {
        return None;
    }
    let (start_str, end_str) = spec.split_once('-')?;
    let start_str = start_str.trim();
    let end_str = end_str.trim();

    if start_str.is_empty() {
        let suffix: u64 = end_str.parse().ok()?;
        if suffix == 0 {
            return None;
        }
        let start = total_len.saturating_sub(suffix);
        return Some(ByteRange {
            start,
            end: total_len - 1,
        });
    }

    let start: u64 = start_str.parse().ok()?;
    if start >= total_len {
        return None;
    }
    let end = if end_str.is_empty() {
        total_len - 1
    } else {
        let parsed_end: u64 = end_str.parse().ok()?;
        if parsed_end < start {
            return None;
        }
        parsed_end.min(total_len - 1)
    };

    Some(ByteRange { start, end })
}

/// Resolves the audio engine's currently loaded local file path, ignoring URLs and raw UI paths.
pub fn engine_local_track_path(engine: &audio_engine::AudioEngine) -> Option<PathBuf> {
    let raw_uri = engine
        .current_uri()
        .filter(|u| !u.starts_with("stem"))
        .or_else(|| engine.original_track_uri())
        .or_else(|| engine.queue().current_item().map(|item| item.uri.clone()))?;

    if raw_uri.starts_with("http://") || raw_uri.starts_with("https://") {
        return None;
    }
    Some(audio_engine::uri::local_path(&raw_uri))
}

fn content_type_for_path(path: &Path) -> &'static str {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_ascii_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        _ => "image/jpeg",
    }
}

fn response_404() -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(Vec::new())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn response_416(total_len: u64) -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::RANGE_NOT_SATISFIABLE)
        .header(header::CONTENT_RANGE, format!("bytes */{total_len}"))
        .body(Vec::new())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn response_bytes(status: StatusCode, content_type: &str, bytes: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, CACHE_CONTROL_IMMUTABLE)
        .header(header::CONTENT_LENGTH, bytes.len().to_string())
        .body(bytes)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

/// Resolves a cover [`MediaRoute`] to its cached thumbnail file path at `size` (`256` or `768`).
pub async fn resolve_cover_thumbnail_path(
    state: &AppState,
    route: &MediaRoute,
    size_override: Option<u32>,
) -> Option<PathBuf> {
    match route {
        MediaRoute::AlbumCover { album_id, size } => {
            let target_size = size_override.unwrap_or(*size);
            let album = state.db.get_album_by_id(*album_id).await.ok().flatten()?;
            let cover_str = album.cover_path.filter(|s| !s.trim().is_empty())?;
            if cover_str.starts_with("http://") || cover_str.starts_with("https://") {
                return None;
            }
            let src = audio_engine::uri::local_path(&cover_str);
            tauri::async_runtime::spawn_blocking(move || thumbnail_file(&src, target_size))
                .await
                .ok()
                .flatten()
        }
        MediaRoute::TrackCover { track_id, size } => {
            let target_size = size_override.unwrap_or(*size);
            let track = state.db.get_track_by_id(*track_id).await.ok().flatten()?;
            let album_cover = match track.album_id {
                Some(alb_id) => state
                    .db
                    .get_album_by_id(alb_id)
                    .await
                    .ok()
                    .flatten()
                    .and_then(|alb| alb.cover_path)
                    .filter(|s| {
                        !s.trim().is_empty()
                            && !s.starts_with("http://")
                            && !s.starts_with("https://")
                    }),
                None => None,
            };
            let track_path = audio_engine::uri::local_path(&track.path);
            tauri::async_runtime::spawn_blocking(move || {
                if let Some(cp) = album_cover {
                    let cover_path = audio_engine::uri::local_path(&cp);
                    if let Some(thumb) = thumbnail_file(&cover_path, target_size) {
                        return Some(thumb);
                    }
                }
                thumbnail_for_audio(&track_path, target_size)
            })
            .await
            .ok()
            .flatten()
        }
        MediaRoute::CurrentCover { size } => {
            let target_size = size_override.unwrap_or(*size);
            let engine_path = engine_local_track_path(&state.engine)?;
            tauri::async_runtime::spawn_blocking(move || {
                thumbnail_for_audio(&engine_path, target_size)
            })
            .await
            .ok()
            .flatten()
        }
        MediaRoute::Background { .. } => None,
    }
}

fn serve_background_file(
    data_dir: &Path,
    file_name: &str,
    range_header: Option<&str>,
) -> Response<Vec<u8>> {
    let candidate = backgrounds_dir(data_dir).join(file_name);
    let Ok(resolved) = crate::commands::paths::ensure_readable(&candidate, BACKGROUND_EXTENSIONS)
    else {
        debug!("auralune-media bg 404 (not readable): {file_name}");
        return response_404();
    };
    let Ok(mut file) = File::open(&resolved) else {
        debug!("auralune-media bg 404 (open failed): {file_name}");
        return response_404();
    };
    let Ok(meta) = file.metadata() else {
        return response_404();
    };
    let total_len = meta.len();
    let mime = content_type_for_path(&resolved);

    if let Some(rh) = range_header {
        let Some(range) = parse_range(rh, total_len) else {
            return response_416(total_len);
        };
        let chunk_len = (range.end - range.start + 1) as usize;
        if file.seek(SeekFrom::Start(range.start)).is_err() {
            return response_404();
        }
        let mut buf = Vec::with_capacity(chunk_len);
        if (&mut file)
            .take(chunk_len as u64)
            .read_to_end(&mut buf)
            .is_err()
        {
            return response_404();
        }
        return Response::builder()
            .status(StatusCode::PARTIAL_CONTENT)
            .header(header::CONTENT_TYPE, mime)
            .header(header::CACHE_CONTROL, CACHE_CONTROL_IMMUTABLE)
            .header(header::ACCEPT_RANGES, "bytes")
            .header(
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{total_len}", range.start, range.end),
            )
            .header(header::CONTENT_LENGTH, buf.len().to_string())
            .body(buf)
            .unwrap_or_else(|_| response_404());
    }

    let mut bytes = Vec::with_capacity(total_len.min(16 * 1024 * 1024) as usize);
    if file.read_to_end(&mut bytes).is_err() {
        return response_404();
    }
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CACHE_CONTROL, CACHE_CONTROL_IMMUTABLE)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, bytes.len().to_string())
        .body(bytes)
        .unwrap_or_else(|_| response_404())
}

/// Asynchronous Tauri URI scheme protocol handler registered under `auralune-media`.
pub fn handle_request<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let uri_str = request.uri().to_string();
    let Some(route) = parse_media_route(&uri_str) else {
        debug!("auralune-media 404 (invalid route): {uri_str}");
        responder.respond(response_404());
        return;
    };

    let range_header = request
        .headers()
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let app_handle = ctx.app_handle().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let Some(state) = app_handle.try_state::<AppState>() else {
            responder.respond(response_404());
            return;
        };

        let response = match route {
            MediaRoute::Background { ref file_name } => {
                let data_dir = APP_DATA_DIR
                    .get()
                    .cloned()
                    .or_else(|| app_handle.path().app_data_dir().ok());
                match data_dir {
                    Some(dir) => serve_background_file(&dir, file_name, range_header.as_deref()),
                    None => response_404(),
                }
            }
            ref cover_route => {
                let thumb_path = state.rt.block_on(resolve_cover_thumbnail_path(
                    state.inner(),
                    cover_route,
                    None,
                ));
                match thumb_path.and_then(|p| {
                    let mime = content_type_for_path(&p);
                    std::fs::read(&p).ok().map(|bytes| (mime, bytes))
                }) {
                    Some((mime, bytes)) => response_bytes(StatusCode::OK, mime, bytes),
                    None => {
                        debug!("auralune-media 404 (cover miss): {uri_str}");
                        response_404()
                    }
                }
            }
        };

        responder.respond(response);
    });
}
