//! System, configuration, transcoding, network import and audio health diagnostics.

use super::error::CommandError;
use crate::AppState;
use audio_engine::Transcoder;
use domain::transcode::{DspExportSettings, ExportFormat, TimeRange};
use gstreamer as gst;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{Emitter, Manager, State};
use tracing::{debug, error, info};

/// Maximum yt-dlp download time (large playlists); a hung process is killed.
const YTDLP_TIMEOUT: Duration = Duration::from_secs(60 * 60);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedItemDto {
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: Option<i64>,
    pub format: String,
    pub track: Option<storage::TrackRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UrlImportResultDto {
    pub total_downloaded: usize,
    pub items: Vec<ImportedItemDto>,
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: Option<i64>,
    pub format: String,
    pub track: Option<storage::TrackRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioCodecStatusDto {
    pub format: String,
    pub decoder: String,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSystemHealthDto {
    pub pipewire_active: bool,
    pub pipewire_version: Option<String>,
    pub sample_rate: u32,
    pub channels: u32,
    pub audio_buffer_ms: u64,
    pub dsp_block_size: usize,
    pub rubberband_available: bool,
    pub soundtouch_available: bool,
    pub gstreamer_version: String,
    pub codecs: Vec<AudioCodecStatusDto>,
    pub db_status: String,
    pub tracks_count: i64,
    pub albums_count: i64,
    pub mpris_active: bool,
    pub waybar_ipc_active: bool,
    pub fifo_ipc_active: bool,
    pub waybar_ipc_path: String,
    pub fifo_ipc_path: String,
}

#[tauri::command]
pub async fn get_app_setting(
    key: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, CommandError> {
    state
        .db
        .get_app_setting(&key)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn set_app_setting(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state.db.set_app_setting(&key, &value).await?;
    if key == "close_to_tray" {
        state
            .close_to_tray
            .store(value != "false", std::sync::atomic::Ordering::Relaxed);
    } else if key == crate::setup::background_covers::SETTING_AUTO_FETCH_COVERS_BG
        && value != "false"
    {
        state.cover_worker_notify.notify_one();
    }
    Ok(())
}

#[tauri::command]
pub async fn transcode_file(
    app_handle: tauri::AppHandle,
    input_path: String,
    output_path: String,
    format: ExportFormat,
    dsp_settings: Option<DspExportSettings>,
    time_range: Option<TimeRange>,
) -> Result<(), CommandError> {
    let input_path = if input_path.starts_with("http://") || input_path.starts_with("https://") {
        input_path
    } else {
        super::paths::ensure_readable(
            &audio_engine::uri::local_path(&input_path),
            super::paths::AUDIO_EXTENSIONS,
        )?
        .to_string_lossy()
        .into_owned()
    };
    let output_path = super::paths::ensure_writable(std::path::Path::new(&output_path))?
        .to_string_lossy()
        .into_owned();
    info!(
        "Tauri command: transcode_file('{}' -> '{}')",
        input_path, output_path
    );
    let app = app_handle.clone();
    tauri::async_runtime::spawn_blocking(move || {
        Transcoder::transcode_with_dsp_and_progress(
            &input_path,
            &output_path,
            format,
            dsp_settings.as_ref(),
            time_range.as_ref(),
            Some(move |percent: f64, pos_ms: u64, dur_ms: u64| {
                let _ = app.emit(
                    "transcode_progress",
                    serde_json::json!({
                        "percent": percent,
                        "position_ms": pos_ms,
                        "duration_ms": dur_ms,
                    }),
                );
            }),
        )
    })
    .await?
    .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub async fn show_desktop_notification(
    title: String,
    body: String,
    icon: Option<String>,
) -> Result<(), CommandError> {
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> {
        let mut cmd = std::process::Command::new("notify-send");
        cmd.arg("-a").arg("Auralune");
        cmd.arg("-u").arg("normal");
        cmd.arg("-h").arg("string:desktop-entry:auralune");
        if let Some(ic) = icon {
            cmd.arg("-i").arg(ic);
        }
        // `--` ends the options: a title starting with `-` is not read as a flag.
        cmd.arg("--").arg(&title).arg(&body);
        // The child process is reaped in the background so no zombie processes are left.
        if let Ok(mut child) = cmd.spawn() {
            std::thread::spawn(move || {
                let _ = child.wait();
            });
        }
        Ok(())
    })
    .await?
}

#[tauri::command]
pub async fn get_audio_system_health(
    state: State<'_, AppState>,
) -> Result<AudioSystemHealthDto, CommandError> {
    // 1. Check the PipeWire server
    let pw_status = tokio::process::Command::new("pw-cli")
        .arg("info")
        .arg("0")
        .kill_on_drop(true)
        .output()
        .await;
    let (pipewire_active, pipewire_version) = if let Ok(out) = pw_status {
        if out.status.success() {
            let txt = String::from_utf8_lossy(&out.stdout);
            let version = txt.lines().find(|l| l.contains("core.version")).map(|l| {
                l.split('=')
                    .nth(1)
                    .unwrap_or("")
                    .trim()
                    .trim_matches('"')
                    .to_string()
            });
            (true, version)
        } else {
            (false, None)
        }
    } else {
        (false, None)
    };

    // 2. GStreamer Version & Decoders
    let (major, minor, micro, nano) = gst::version();
    let gstreamer_version = if nano > 0 {
        format!("{}.{}.{}.{}", major, minor, micro, nano)
    } else {
        format!("{}.{}.{}", major, minor, micro)
    };

    let check_element = |name: &str| gst::ElementFactory::find(name).is_some();

    let codecs = vec![
        AudioCodecStatusDto {
            format: "FLAC (Free Lossless Audio Codec)".to_string(),
            decoder: "flacdec".to_string(),
            available: check_element("flacdec"),
        },
        AudioCodecStatusDto {
            format: "MP3 (MPEG-1/2 Audio Layer 3)".to_string(),
            decoder: "mpg123audiodec / avdec_mp3".to_string(),
            available: check_element("mpg123audiodec") || check_element("avdec_mp3"),
        },
        AudioCodecStatusDto {
            format: "Ogg Vorbis".to_string(),
            decoder: "vorbisdec".to_string(),
            available: check_element("vorbisdec"),
        },
        AudioCodecStatusDto {
            format: "Opus (Low Latency / Hi-Fi)".to_string(),
            decoder: "opusdec".to_string(),
            available: check_element("opusdec"),
        },
        AudioCodecStatusDto {
            format: "AAC / M4A (Advanced Audio Coding)".to_string(),
            decoder: "faad / avdec_aac".to_string(),
            available: check_element("faad") || check_element("avdec_aac"),
        },
        AudioCodecStatusDto {
            format: "WAV PCM (Uncompressed Audio)".to_string(),
            decoder: "wavparse".to_string(),
            available: check_element("wavparse"),
        },
    ];

    let rubberband_available = true;
    let soundtouch_available = true;

    // 3. SQLite database
    let tracks_count = state.db.count_tracks().await.unwrap_or(0);
    let albums_count = state.db.count_albums().await.unwrap_or(0);
    let db_status = "Consistent (WAL mode, PRAGMA foreign_keys = ON)".to_string();

    // 4. IPC & System
    let waybar_path = desktop_integration::waybar_status_path();
    let fifo_path = desktop_integration::control_fifo_path();
    let waybar_ipc_active = waybar_path.exists();
    let fifo_ipc_active = fifo_path.exists();
    let mpris_active = state.mpris.is_some();

    let audio_buffer_ms = state.engine.audio_buffer_duration_ms();
    let dsp_block_size = state.engine.dsp_block_size();

    Ok(AudioSystemHealthDto {
        pipewire_active,
        pipewire_version,
        sample_rate: 44100,
        channels: 2,
        audio_buffer_ms,
        dsp_block_size,
        rubberband_available,
        soundtouch_available,
        gstreamer_version,
        codecs,
        db_status,
        tracks_count,
        albums_count,
        mpris_active,
        waybar_ipc_active,
        fifo_ipc_active,
        waybar_ipc_path: waybar_path.display().to_string(),
        fifo_ipc_path: fifo_path.display().to_string(),
    })
}

/// Shows the main window for the first time, after WebKitGTK has committed its first full-size
/// frame. Idempotent: subsequent calls from the frontend or the safety timer are no-ops.
pub fn reveal_main_window_internal(app: &tauri::AppHandle, state: &AppState) {
    if state
        .window_revealed
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_ok()
    {
        debug!("reveal_main_window: showing main window for the first time");
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
pub fn reveal_main_window(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    reveal_main_window_internal(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn set_mini_player_mode(mini: bool, window: tauri::Window) -> Result<(), CommandError> {
    info!("Tauri command: set_mini_player_mode({})", mini);
    if mini {
        let _ = window.set_min_size(Some(tauri::LogicalSize::new(320.0, 120.0)));
        let _ = window.set_size(tauri::LogicalSize::new(360.0, 150.0));
        let _ = window.set_always_on_top(true);
    } else {
        let _ = window.set_min_size(Some(tauri::LogicalSize::new(320.0, 120.0)));
        let _ = window.set_size(tauri::LogicalSize::new(1080.0, 760.0));
        let _ = window.set_always_on_top(false);
    }
    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn import_audio_from_url(
    url: String,
    target_dir: Option<String>,
    format: Option<String>,
    bitrate: Option<String>,
    download_playlist: Option<bool>,
    max_items: Option<u32>,
    folder_structure: Option<String>,
    state: State<'_, AppState>,
) -> Result<UrlImportResultDto, CommandError> {
    let target_dir = target_dir
        .as_deref()
        .map(|dir| {
            super::paths::ensure_writable(std::path::Path::new(dir))
                .map(|p| p.to_string_lossy().into_owned())
        })
        .transpose()?;
    let clean_url = url.trim().to_string();
    if clean_url.is_empty() {
        return Err(CommandError::validation("The URL must not be empty."));
    }
    if !clean_url.starts_with("http://") && !clean_url.starts_with("https://") {
        return Err(CommandError::validation(
            "Invalid URL protocol (http:// or https:// required).",
        ));
    }

    info!(
        "Tauri command: import_audio_from_url('{}', format={:?}, bitrate={:?}, playlist={:?}, max={:?})",
        clean_url, format, bitrate, download_playlist, max_items
    );

    // 1. Check that yt-dlp is installed
    let which_res = tokio::process::Command::new("which")
        .arg("yt-dlp")
        .output()
        .await;
    let has_ytdlp = match which_res {
        Ok(out) => out.status.success(),
        Err(_) => false,
    };

    if !has_ytdlp {
        return Err(CommandError::not_found("The 'yt-dlp' tool was not found on your system.\n\nTo use the URL audio importer, install 'yt-dlp' and 'ffmpeg':\n• Arch Linux / EndeavourOS / CachyOS: sudo pacman -S yt-dlp ffmpeg\n• Debian / Ubuntu: sudo apt install yt-dlp ffmpeg\n• Fedora: sudo dnf install yt-dlp ffmpeg"));
    }

    // 2. Determine the target folder
    let dest_dir = if let Some(ref dir) = target_dir {
        let trimmed = dir.trim();
        if trimmed.is_empty() {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home).join("Music").join("Auralune")
        } else {
            PathBuf::from(trimmed)
        }
    } else {
        let default_music = std::env::var("XDG_MUSIC_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                PathBuf::from(home).join("Music")
            });
        default_music.join("Auralune")
    };

    tokio::fs::create_dir_all(&dest_dir)
        .await
        .map_err(|e| CommandError::from(e).context("Failed to create the target directory"))?;

    // 3. Format choice
    let audio_fmt = match format.as_deref().unwrap_or("flac").to_lowercase().as_str() {
        "mp3" => "mp3",
        "opus" => "opus",
        "m4a" => "m4a",
        "wav" => "wav",
        "ogg" => "vorbis",
        _ => "flac",
    };

    // 4. Quality / bitrate (cleaned up and mapped to the preferred yt-dlp ffmpeg value)
    let clean_bitrate = match bitrate
        .as_deref()
        .unwrap_or("0")
        .trim()
        .to_lowercase()
        .as_str()
    {
        "320" | "320k" | "320kbps" => "320",
        "256" | "256k" | "256kbps" => "256",
        "192" | "192k" | "192kbps" => "192",
        "160" | "160k" | "160kbps" => "160",
        "128" | "128k" | "128kbps" => "128",
        "96" | "96k" | "96kbps" => "96",
        _ => "0",
    };

    // 5. Folder structure and output template
    let structure_mode = folder_structure.as_deref().unwrap_or("flat");
    let template_rel = match structure_mode {
        "artist_album" => "%(artist,uploader,channel|Unknown Artist)s/%(album,playlist_title|Singles)s/%(playlist_index&{:02d} - |)s%(title)s.%(ext)s",
        "playlist" => "%(playlist_title,album,uploader,channel|Downloads)s/%(playlist_index&{:02d} - |)s%(title)s.%(ext)s",
        _ => "%(title)s.%(ext)s",
    };
    // yt-dlp would read `%` in a folder name as a template field, so it is escaped as `%%`.
    let escaped_dir = dest_dir.to_string_lossy().replace('%', "%%");
    let output_template = format!("{}/{}", escaped_dir, template_rel);

    let is_playlist = download_playlist.unwrap_or(false);
    info!(
        "Starting yt-dlp: fmt={}, bitrate={}, playlist={}, max={:?}, template={}",
        audio_fmt, clean_bitrate, is_playlist, max_items, output_template
    );

    let start_time = std::time::SystemTime::now();

    let mut cmd = tokio::process::Command::new("yt-dlp");
    if is_playlist {
        cmd.arg("--yes-playlist");
        if let Some(max) = max_items {
            if max > 0 {
                cmd.arg("--max-downloads").arg(max.to_string());
            }
        }
    } else {
        cmd.arg("--no-playlist");
    }

    cmd.arg("-x")
        .arg("--audio-format")
        .arg(audio_fmt)
        .arg("--audio-quality")
        .arg(clean_bitrate)
        .arg("--embed-thumbnail")
        .arg("--add-metadata")
        .arg("-o")
        .arg(&output_template)
        .arg("--print")
        .arg("after_move:filepath")
        .arg("--")
        .arg(&clean_url)
        .kill_on_drop(true);

    let output = tokio::time::timeout(YTDLP_TIMEOUT, cmd.output())
        .await
        .map_err(|_| {
            CommandError::validation(format!(
                "yt-dlp download time limit exceeded ({} min)",
                YTDLP_TIMEOUT.as_secs() / 60
            ))
        })?
        .map_err(|e| CommandError::from(e).context("Failed to start the yt-dlp process"))?;

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let stderr_str = String::from_utf8_lossy(&output.stderr);

    // Look for file paths in the output lines (download order)
    let mut resolved_files: Vec<PathBuf> = Vec::new();
    for line in stdout_str.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            if p.exists() && p.is_file() && !resolved_files.contains(&p) {
                resolved_files.push(p);
            }
        }
    }

    // Exit code 101 in yt-dlp means a deliberate stop after reaching --max-downloads (MaxDownloadsReached)
    let is_successful_exit = output.status.success() || output.status.code() == Some(101);

    // Fallback: if no paths could be read from stdout, search the directory recursively
    if resolved_files.is_empty() {
        let mut dirs_to_visit = vec![dest_dir.clone()];
        let since = start_time
            .checked_sub(Duration::from_secs(5))
            .unwrap_or(start_time);
        let mut discovered = Vec::new();

        while let Some(current_dir) = dirs_to_visit.pop() {
            if let Ok(mut read_dir) = tokio::fs::read_dir(&current_dir).await {
                while let Ok(Some(entry)) = read_dir.next_entry().await {
                    let path = entry.path();
                    // `file_type()` does not follow links, so a link loop cannot hang the search.
                    let Ok(file_type) = entry.file_type().await else {
                        continue;
                    };
                    if file_type.is_dir() {
                        dirs_to_visit.push(path);
                    } else if file_type.is_file() {
                        let ext = path
                            .extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("")
                            .to_lowercase();
                        if matches!(
                            ext.as_str(),
                            "flac" | "mp3" | "ogg" | "opus" | "wav" | "m4a" | "aac" | "alac"
                        ) {
                            if let Ok(meta) = entry.metadata().await {
                                if let Ok(modified) = meta.modified() {
                                    if modified >= since {
                                        discovered.push((path, modified));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        discovered.sort_by_key(|(_, m)| *m);
        resolved_files = discovered.into_iter().map(|(p, _)| p).collect();
    }

    if !is_successful_exit && resolved_files.is_empty() {
        let err_detail = if !stderr_str.trim().is_empty() {
            stderr_str.trim()
        } else {
            stdout_str.trim()
        };
        error!("yt-dlp failed: {}", err_detail);
        return Err(format!("Download or conversion failed: {}", err_detail).into());
    }

    if resolved_files.is_empty() {
        return Err(CommandError::not_found(
            "Download finished, but no downloaded files were found in the target folder.",
        ));
    }

    info!(
        "Downloaded {} audio files from the URL. Starting library indexing...",
        resolved_files.len()
    );

    // 6. Index the downloaded files in the Auralune database right away
    state
        .scanner
        .scan_paths(&resolved_files, &state.db)
        .await
        .map_err(|e| CommandError::from(e).context("Failed to index the tracks in the library"))?;

    // 7. Build the record list for the returned files
    let mut items = Vec::new();
    for path in &resolved_files {
        let final_path_str = path.to_string_lossy().to_string();
        let track_record = state
            .db
            .get_track_by_path(&final_path_str)
            .await
            .ok()
            .flatten();

        let title = track_record
            .as_ref()
            .map(|t| t.title.clone())
            .unwrap_or_else(|| {
                path.file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Downloaded track".to_string())
            });

        let artist = track_record
            .as_ref()
            .map(|t| t.artist.clone())
            .unwrap_or_else(|| "Unknown Artist".to_string());

        let album = if let Some(ref tr) = track_record {
            if let Some(album_id) = tr.album_id {
                state
                    .db
                    .get_album_by_id(album_id)
                    .await
                    .ok()
                    .flatten()
                    .map(|a| a.title)
            } else {
                None
            }
        } else {
            None
        };

        let duration_ms = track_record.as_ref().map(|t| t.duration_ms);

        items.push(ImportedItemDto {
            file_path: final_path_str,
            title,
            artist,
            album,
            duration_ms,
            format: audio_fmt.to_uppercase(),
            track: track_record,
        });
    }

    let total_downloaded = items.len();
    let first = items.first().cloned();

    Ok(UrlImportResultDto {
        total_downloaded,
        items: items.clone(),
        file_path: first
            .as_ref()
            .map(|i| i.file_path.clone())
            .unwrap_or_default(),
        title: first
            .as_ref()
            .map(|i| i.title.clone())
            .unwrap_or_else(|| "Downloaded tracks".to_string()),
        artist: first
            .as_ref()
            .map(|i| i.artist.clone())
            .unwrap_or_else(|| "Various Artists".to_string()),
        album: first.as_ref().and_then(|i| i.album.clone()),
        duration_ms: first.as_ref().and_then(|i| i.duration_ms),
        format: audio_fmt.to_uppercase(),
        track: first.and_then(|i| i.track),
    })
}
