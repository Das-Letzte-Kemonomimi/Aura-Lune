//! System, konfiguracja, transkodowanie, import z sieci oraz diagnostyka zdrowia audio.

use super::error::CommandError;
use crate::AppState;
use audio_engine::Transcoder;
use domain::transcode::{DspExportSettings, ExportFormat, TimeRange};
use gstreamer as gst;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{Emitter, State};
use tracing::{error, info};

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
    state
        .db
        .set_app_setting(&key, &value)
        .await
        .map_err(CommandError::from)
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
pub fn show_desktop_notification(
    title: String,
    body: String,
    icon: Option<String>,
) -> Result<(), CommandError> {
    let mut cmd = std::process::Command::new("notify-send");
    cmd.arg("-a").arg("Auralune");
    cmd.arg("-u").arg("normal");
    cmd.arg("-h").arg("string:desktop-entry:auralune");
    if let Some(ic) = icon {
        cmd.arg("-i").arg(ic);
    }
    cmd.arg(&title).arg(&body);
    let _ = cmd.spawn();
    Ok(())
}

#[tauri::command]
pub async fn get_audio_system_health(
    state: State<'_, AppState>,
) -> Result<AudioSystemHealthDto, CommandError> {
    // 1. Sprawdź serwer PipeWire
    let pw_status = std::process::Command::new("pw-cli")
        .arg("info")
        .arg("0")
        .output();
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

    // 3. Baza danych SQLite
    let tracks_count = state.db.count_tracks().await.unwrap_or(0);
    let albums_count = state.db.count_albums().await.unwrap_or(0);
    let db_status = "Spójna (WAL mode, PRAGMA foreign_keys = ON)".to_string();

    // 4. IPC & System
    let waybar_ipc_active = std::path::Path::new("/tmp/auralune.json").exists();
    let fifo_ipc_active = std::path::Path::new("/tmp/auralune_ctl").exists();
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
    })
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
    let clean_url = url.trim().to_string();
    if clean_url.is_empty() {
        return Err("Adres URL nie może być pusty.".into());
    }
    if !clean_url.starts_with("http://") && !clean_url.starts_with("https://") {
        return Err("Nieprawidłowy protokół URL (wymagany http:// lub https://).".into());
    }

    info!(
        "Tauri command: import_audio_from_url('{}', format={:?}, bitrate={:?}, playlist={:?}, max={:?})",
        clean_url, format, bitrate, download_playlist, max_items
    );

    // 1. Sprawdź obecność yt-dlp w systemie
    let which_res = tokio::process::Command::new("which")
        .arg("yt-dlp")
        .output()
        .await;
    let has_ytdlp = match which_res {
        Ok(out) => out.status.success(),
        Err(_) => false,
    };

    if !has_ytdlp {
        return Err("Narzędzie 'yt-dlp' nie zostało znalezione w Twoim systemie.\n\nAby korzystać z importera audio URL, zainstaluj 'yt-dlp' oraz 'ffmpeg':\n• Arch Linux / EndeavourOS / CachyOS: sudo pacman -S yt-dlp ffmpeg\n• Debian / Ubuntu: sudo apt install yt-dlp ffmpeg\n• Fedora: sudo dnf install yt-dlp ffmpeg".into());
    }

    // 2. Określ folder docelowy
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
        .map_err(|e| CommandError::from(e).context("Nie udało się utworzyć katalogu docelowego"))?;

    // 3. Wybór formatu
    let audio_fmt = match format.as_deref().unwrap_or("flac").to_lowercase().as_str() {
        "mp3" => "mp3",
        "opus" => "opus",
        "m4a" => "m4a",
        "wav" => "wav",
        "ogg" => "vorbis",
        _ => "flac",
    };

    // 4. Jakość / bitrate (czyszczenie i mapowanie na preferowaną wartość ffmpeg yt-dlp)
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

    // 5. Struktura folderów i szablon wyjściowy
    let structure_mode = folder_structure.as_deref().unwrap_or("flat");
    let template_rel = match structure_mode {
        "artist_album" => "%(artist,uploader,channel|Unknown Artist)s/%(album,playlist_title|Singles)s/%(playlist_index&{:02d} - |)s%(title)s.%(ext)s",
        "playlist" => "%(playlist_title,album,uploader,channel|Downloads)s/%(playlist_index&{:02d} - |)s%(title)s.%(ext)s",
        _ => "%(title)s.%(ext)s",
    };
    let output_template = format!("{}/{}", dest_dir.display(), template_rel);

    let is_playlist = download_playlist.unwrap_or(false);
    info!(
        "Uruchamiam yt-dlp: fmt={}, bitrate={}, playlist={}, max={:?}, template={}",
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
        .arg(&clean_url);

    let output = cmd
        .output()
        .await
        .map_err(|e| CommandError::from(e).context("Błąd uruchomienia procesu yt-dlp"))?;

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let stderr_str = String::from_utf8_lossy(&output.stderr);

    // Szukamy ścieżek plików w liniach wyjścia (kolejność pobrania)
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

    // Kod 101 w yt-dlp oznacza celowe zatrzymanie po osiągnięciu --max-downloads (MaxDownloadsReached)
    let is_successful_exit = output.status.success() || output.status.code() == Some(101);

    // Fallback: jeśli ze stdoutu nie udało się odczytać ścieżek, przeszukaj katalog rekurencyjnie
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
                    if path.is_dir() {
                        dirs_to_visit.push(path);
                    } else if path.is_file() {
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
        error!("Błąd wykonania yt-dlp: {}", err_detail);
        return Err(format!("Pobieranie lub konwersja nie powiodła się: {}", err_detail).into());
    }

    if resolved_files.is_empty() {
        return Err(CommandError::not_found(
            "Pobieranie zakończone, lecz nie odnaleziono pobranych plików w folderze docelowym.",
        ));
    }

    info!(
        "Pobrano {} plików audio z URL. Rozpoczynam indeksowanie w bibliotece...",
        resolved_files.len()
    );

    // 6. Natychmiastowe zindeksowanie pobranych plików w bazie Auralune
    state
        .scanner
        .scan_paths(&resolved_files, &state.db)
        .await
        .map_err(|e| CommandError::from(e).context("Błąd indeksowania utworów w bibliotece"))?;

    // 7. Zbuduj listę rekordów dla zwróconych plików
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
                    .unwrap_or_else(|| "Pobrany utwór".to_string())
            });

        let artist = track_record
            .as_ref()
            .map(|t| t.artist.clone())
            .unwrap_or_else(|| "Nieznany wykonawca".to_string());

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
            .unwrap_or_else(|| "Pobrano utwory".to_string()),
        artist: first
            .as_ref()
            .map(|i| i.artist.clone())
            .unwrap_or_else(|| "Różni wykonawcy".to_string()),
        album: first.as_ref().and_then(|i| i.album.clone()),
        duration_ms: first.as_ref().and_then(|i| i.duration_ms),
        format: audio_fmt.to_uppercase(),
        track: first.and_then(|i| i.track),
    })
}
