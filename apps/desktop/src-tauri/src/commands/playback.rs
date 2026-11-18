use crate::AppState;
use audio_engine::PlayerEvent;
use domain::queue::{LoopMode, QueueItem};
use domain::replaygain::ReplayGainConfig;
use domain::PlaybackState;
use dsp_api::{DspCapabilities, DspEngine};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{Emitter, Manager, State};
use tracing::info;

use crate::commands::queue::persist_queue_state;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackStatusDto {
    pub state: PlaybackState,
    pub position_ms: u64,
    pub duration_ms: Option<u64>,
    pub volume: f64,
    pub pitch_semitones: f64,
    pub tempo_ratio: f64,
    pub rate_ratio: f64,
    pub engine: DspEngine,
    pub capabilities: DspCapabilities,
    pub loop_mode: LoopMode,
    pub shuffle: bool,
    pub stop_after_current: bool,
    pub current_track: Option<QueueItem>,
    pub equalizer_enabled: bool,
    pub equalizer_bands: [f64; 10],
    pub parametric_eq_enabled: bool,
    pub compressor_enabled: bool,
    pub saturator_enabled: bool,
    pub limiter_enabled: bool,
    pub spectrum: Vec<f32>,
    pub replaygain_config: ReplayGainConfig,
    pub replaygain_status: (f64, f64, bool),
    pub live_stream_title: Option<String>,
    pub is_stems_active: bool,
    pub active_stem_project_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SampleTrackDto {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_ms: u64,
    pub genre: Option<String>,
}

pub fn resolve_or_extract_sample_track(data_dir: &Path) -> Option<SampleTrackDto> {
    // 1. Sprawdź znane lokalizacje pliku na dysku (w trybie dev, test fixtures lub w katalogu danych)
    let candidates = [
        data_dir.join("sample").join("Skrzydła Białe.flac"),
        PathBuf::from("tests/fixtures/Skrzydła Białe.flac"),
        PathBuf::from("/usr/share/auralune/Skrzydła Białe.flac"),
    ];

    for candidate in &candidates {
        if candidate.exists() && candidate.is_file() {
            let path_str = candidate
                .canonicalize()
                .unwrap_or_else(|_| candidate.clone())
                .to_string_lossy()
                .to_string();
            return Some(SampleTrackDto {
                path: path_str,
                title: "Skrzydła Białe".to_string(),
                artist: "Das Letzte Kemonomimi".to_string(),
                album: Some("Skrzydła Białe".to_string()),
                duration_ms: 56820,
                genre: Some("Folk-Rock".to_string()),
            });
        }
    }

    // 2. Jeśli plik nie istnieje (np. na czystym systemie/AppImage), wyodrębnij osadzony utwór do data_dir/sample/
    static EMBEDDED_SAMPLE: &[u8] =
        include_bytes!("../../../../../tests/fixtures/Skrzydła Białe.flac");
    let target_path = data_dir.join("sample").join("Skrzydła Białe.flac");
    if let Some(parent) = target_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if std::fs::write(&target_path, EMBEDDED_SAMPLE).is_ok() {
        let path_str = target_path
            .canonicalize()
            .unwrap_or_else(|_| target_path.clone())
            .to_string_lossy()
            .to_string();
        Some(SampleTrackDto {
            path: path_str,
            title: "Skrzydła Białe".to_string(),
            artist: "Das Letzte Kemonomimi".to_string(),
            album: Some("Skrzydła Białe".to_string()),
            duration_ms: 56820,
            genre: Some("Folk-Rock".to_string()),
        })
    } else {
        None
    }
}

pub fn normalize_path_or_url(input: &str, cwd: Option<&str>) -> Option<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.starts_with("file://") {
        if let Ok(parsed) = url::Url::parse(trimmed) {
            if let Ok(path) = parsed.to_file_path() {
                if path.exists() {
                    return Some(path.to_string_lossy().to_string());
                }
            }
        }
        let stripped = trimmed.trim_start_matches("file://");
        let p = Path::new(stripped);
        if p.exists() {
            return Some(p.to_string_lossy().to_string());
        }
    } else if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return Some(trimmed.to_string());
    }

    let p = Path::new(trimmed);
    if p.is_file() {
        if let Ok(canonical) = p.canonicalize() {
            return Some(canonical.to_string_lossy().to_string());
        }
        return Some(trimmed.to_string());
    }

    if let Some(c) = cwd {
        let joined = Path::new(c).join(trimmed);
        if joined.is_file() {
            if let Ok(canonical) = joined.canonicalize() {
                return Some(canonical.to_string_lossy().to_string());
            }
            return Some(joined.to_string_lossy().to_string());
        }
    }

    None
}

pub fn is_supported_audio(path: &str) -> bool {
    let p = Path::new(path);
    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
        matches!(
            ext.to_ascii_lowercase().as_str(),
            "mp3"
                | "flac"
                | "ogg"
                | "opus"
                | "wav"
                | "wave"
                | "m4a"
                | "aac"
                | "alac"
                | "aiff"
                | "aif"
                | "wma"
                | "m3u"
                | "m3u8"
                | "cue"
        )
    } else {
        false
    }
}

pub fn extract_audio_paths_from_args(args: &[String], cwd: Option<&str>) -> Vec<String> {
    let mut results = Vec::new();
    for arg in args.iter().skip(1) {
        if arg.starts_with('-') {
            continue;
        }
        if let Some(valid_path) = normalize_path_or_url(arg, cwd) {
            if is_supported_audio(&valid_path)
                || valid_path.starts_with("http://")
                || valid_path.starts_with("https://")
            {
                results.push(valid_path);
            }
        }
    }
    results
}

pub async fn resolve_queue_item(path: &str, state: &AppState) -> QueueItem {
    let track_opt = state.db.get_track_by_path(path).await.ok().flatten();
    let album_title = if let Some(ref tr) = track_opt {
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

    if let Some(tr) = track_opt {
        QueueItem {
            id: format!("track-{}", tr.id),
            track_id: Some(tr.id),
            uri: tr.path,
            title: tr.title,
            artist: tr.artist,
            album: album_title,
            duration_ms: tr.duration_ms as u64,
        }
    } else {
        let fallback_stem = Path::new(path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Nieznany utwór".to_string());

        let (title, artist, album, duration_ms) =
            if let Ok(m) = audio_engine::read_track_metadata(path) {
                let t = if !m.title.trim().is_empty() {
                    m.title
                } else if fallback_stem.contains(" - ") {
                    fallback_stem
                        .split_once(" - ")
                        .map(|(_, t)| t.trim().to_string())
                        .unwrap_or_else(|| fallback_stem.clone())
                } else {
                    fallback_stem.clone()
                };

                let a = if !m.artist.trim().is_empty() {
                    m.artist
                } else if fallback_stem.contains(" - ") {
                    fallback_stem
                        .split_once(" - ")
                        .map(|(a, _)| a.trim().to_string())
                        .unwrap_or_else(|| "Plik lokalny".to_string())
                } else {
                    "Plik lokalny".to_string()
                };

                (t, a, m.album, 0)
            } else if fallback_stem.contains(" - ") {
                let (a, t) = fallback_stem.split_once(" - ").unwrap();
                (t.trim().to_string(), a.trim().to_string(), None, 0)
            } else {
                (fallback_stem, "Plik lokalny".to_string(), None, 0)
            };

        QueueItem {
            id: format!(
                "file-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            ),
            track_id: None,
            uri: path.to_string(),
            title,
            artist,
            album,
            duration_ms,
        }
    }
}

pub async fn enqueue_and_play_files(
    files: Vec<String>,
    state: &AppState,
    app_handle: &tauri::AppHandle,
) {
    if files.is_empty() {
        return;
    }

    info!(
        "Przetwarzanie i odtwarzanie plików zewnętrznych: {:?}",
        files
    );

    let playback_mode = state
        .db
        .get_app_setting("album_playback_mode")
        .await
        .unwrap_or(None)
        .unwrap_or_else(|| "replace".to_string());

    let mut new_items = Vec::new();
    for f in &files {
        new_items.push(resolve_queue_item(f, state).await);
    }

    if let Ok(mut t) = state.latest_live_stream_tag.lock() {
        *t = None;
    }

    if playback_mode == "append" {
        let mut current_queue = state.engine.queue();
        let start_index = current_queue.items.len();
        current_queue.items.extend(new_items);
        let _ = state
            .engine
            .set_queue(current_queue.items, Some(start_index));
    } else {
        let _ = state.engine.set_queue(new_items.clone(), Some(0));
        if let Some(first) = new_items.first() {
            state.engine.set_active_item(first.clone());
            sync_mpris_from_queue_item(first, state);
        }
    }

    let _ = state.engine.play_with_fade(true);
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_playback_status(PlaybackState::Playing).await;
        });
    }

    persist_queue_state(state);
    let _ = app_handle.emit("queue_changed", ());
}

/// Synchronizes playback state changes to desktop integrations (MPRIS D-Bus and Discord RPC).
pub fn sync_desktop_playback_state(state: &AppState, new_state: PlaybackState) {
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_playback_status(new_state).await;
        });
    }

    let Some(discord) = &state.discord_rpc else {
        return;
    };

    if new_state == PlaybackState::Stopped {
        discord.clear_activity();
        return;
    }

    let pos = state
        .engine
        .position()
        .map(|p| p.as_millis() as u64)
        .unwrap_or(0);
    let dur = state
        .engine
        .duration()
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    discord.update_playback_status(new_state, pos, dur);
}

/// Plays audio via the audio engine and updates desktop status.
pub fn play_internal(state: &AppState) -> Result<(), String> {
    if state.engine.current_uri().is_none() {
        let q = state.engine.queue();
        if let Some(item) = q.current_item() {
            let _ = state.engine.load_uri(&item.uri);
        }
    }
    state
        .engine
        .play_with_fade(true)
        .map_err(|e| e.to_string())?;
    sync_desktop_playback_state(state, PlaybackState::Playing);
    Ok(())
}

/// Pauses audio with a gentle fade-out and updates desktop status.
pub fn pause_internal(state: &AppState) -> Result<(), String> {
    state
        .engine
        .pause_with_fade(true)
        .map_err(|e| e.to_string())?;
    sync_desktop_playback_state(state, PlaybackState::Paused);
    Ok(())
}

/// Stops audio playback and clears desktop status.
pub fn stop_internal(state: &AppState) -> Result<(), String> {
    state.engine.stop().map_err(|e| e.to_string())?;
    sync_desktop_playback_state(state, PlaybackState::Stopped);
    Ok(())
}

/// Seeks to a position in milliseconds with optional crossfade.
pub fn seek_internal(state: &AppState, position_ms: u64, fade: Option<bool>) -> Result<(), String> {
    let should_fade = fade.unwrap_or(true);
    state
        .engine
        .seek_with_fade(Duration::from_millis(position_ms), should_fade)
        .map_err(|e| e.to_string())?;

    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.emit_seeked(position_ms).await;
        });
    }

    if let Some(discord) = &state.discord_rpc {
        discord.update_position(position_ms);
    }

    Ok(())
}

pub fn normalize_art_url(art_url: Option<&str>) -> Option<String> {
    let url = art_url?.trim();
    if url.is_empty() {
        return None;
    }
    if url.starts_with("http://")
        || url.starts_with("https://")
        || url.starts_with("data:image/")
        || url.starts_with("file://")
    {
        return Some(url.to_string());
    }
    let path = Path::new(url);
    if path.exists() && path.is_file() {
        return Some(format!("file://{}", path.to_string_lossy()));
    }
    None
}

/// Synchronizes currently playing track metadata to MPRIS and Discord Rich Presence.
pub fn sync_mpris_from_queue_item(item: &QueueItem, state: &AppState) {
    let title = item.title.clone();
    let artist = item.artist.clone();
    let album = item.album.clone().unwrap_or_default();
    let duration_ms = if item.duration_ms > 0 {
        item.duration_ms
    } else {
        state
            .engine
            .duration()
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    };

    let is_generic_album = album.trim().is_empty()
        || album == "Auralune Player"
        || album == "Auralune Library"
        || album == "Live Stream"
        || album == "Radio internetowe";

    let mut effective_artist = artist.trim().to_string();
    let mut effective_title = title.trim().to_string();
    if (effective_artist == "Plik lokalny" || effective_artist.is_empty())
        && effective_title.contains(" - ")
    {
        if let Some((a, t)) = effective_title.split_once(" - ") {
            effective_artist = a.trim().to_string();
            effective_title = t.trim().to_string();
        }
    }

    let cache_key = if !is_generic_album {
        format!(
            "{}---{}",
            effective_artist.trim().to_lowercase(),
            album.trim().to_lowercase()
        )
    } else {
        format!(
            "{}---{}",
            effective_artist.trim().to_lowercase(),
            effective_title.trim().to_lowercase()
        )
    };
    let cached_art = state.discord_cover_cache.read().ok().and_then(|c| {
        c.get(&cache_key).cloned().or_else(|| {
            let title_key = format!(
                "{}---{}",
                effective_artist.trim().to_lowercase(),
                effective_title.trim().to_lowercase()
            );
            c.get(&title_key).cloned()
        })
    });

    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        let track_info = desktop_integration::MprisTrackInfo {
            title: title.clone(),
            artist: artist.clone(),
            album: album.clone(),
            duration_ms,
            art_url: cached_art.clone(),
        };
        state.rt.spawn(async move {
            m.update_track(track_info).await;
            m.update_playback_status(PlaybackState::Playing).await;
        });
    }
    if let Some(discord) = &state.discord_rpc {
        let discord_art = cached_art
            .as_ref()
            .filter(|u| u.starts_with("http://") || u.starts_with("https://"))
            .cloned();

        let track_info = desktop_integration::DiscordTrackInfo {
            title: title.clone(),
            artist: artist.clone(),
            album: album.clone(),
            duration_ms,
            art_url: discord_art.clone(),
        };
        discord.update_track(track_info);
        let needs_online_search = discord_art.is_none();

        if needs_online_search
            && (!effective_artist.trim().is_empty()
                || !album.trim().is_empty()
                || !effective_title.trim().is_empty())
        {
            let discord_clone = discord.clone();
            let cover_archive = state.cover_archive.clone();
            let cache_clone = state.discord_cover_cache.clone();
            let title_c = effective_title.clone();
            let artist_c = effective_artist.clone();
            let album_c = album.clone();
            state.rt.spawn(async move {
                let mut candidates = if !is_generic_album {
                    cover_archive
                        .search_cover_candidates(&album_c, &artist_c)
                        .await
                } else {
                    Vec::new()
                };
                if candidates.is_empty() && !title_c.trim().is_empty() {
                    candidates = cover_archive
                        .search_cover_candidates(&title_c, &artist_c)
                        .await;
                }
                if let Some(first) = candidates.first() {
                    let best_url = if !first.thumbnail_url.is_empty() {
                        first.thumbnail_url.clone()
                    } else {
                        first.full_url.clone()
                    };
                    if best_url.starts_with("http://") || best_url.starts_with("https://") {
                        if let Ok(mut cache) = cache_clone.write() {
                            cache.insert(cache_key, best_url.clone());
                        }
                        discord_clone.update_track(desktop_integration::DiscordTrackInfo {
                            title: title_c,
                            artist: artist_c,
                            album: album_c,
                            duration_ms,
                            art_url: Some(best_url),
                        });
                    }
                }
            });
        }
    }
}

pub fn get_status_internal(state: &AppState) -> PlaybackStatusDto {
    let q = state.engine.queue();
    let current_track = q.current_item().cloned();

    let is_live_stream = if let Some(ref item) = current_track {
        item.id.starts_with("radio-")
            || (item.track_id.is_none()
                && (item.uri.starts_with("http://") || item.uri.starts_with("https://")))
    } else if let Some(uri) = state.engine.current_uri() {
        uri.starts_with("http://") || uri.starts_with("https://")
    } else {
        false
    };

    let events = state.engine.poll_events();
    for event in events {
        match event {
            PlayerEvent::Spectrum(mags) => {
                if let Ok(mut s) = state.latest_spectrum.lock() {
                    *s = mags;
                }
            }
            PlayerEvent::TrackLooped => {
                info!("get_status: odebrano zdarzenie PlayerEvent::TrackLooped (utwór zapętlony / Repeat)");
                if let Some(discord) = &state.discord_rpc {
                    discord.track_looped();
                }
                if let Some(mpris) = &state.mpris {
                    let m = mpris.clone();
                    state.rt.spawn(async move {
                        m.emit_seeked(0).await;
                    });
                }
            }
            PlayerEvent::Tag(tag) => {
                if is_live_stream {
                    info!("Odebrano tag ze strumienia na żywo: {}", tag);
                    if let Ok(mut t) = state.latest_live_stream_tag.lock() {
                        *t = Some(tag.clone());
                    }

                    // Parsuj "Wykonawca - Tytuł", jeśli strumień nadaje w tym formacie
                    let (parsed_artist, parsed_title) = if let Some((a, t)) = tag.split_once(" - ")
                    {
                        (a.trim().to_string(), t.trim().to_string())
                    } else {
                        let station = current_track
                            .as_ref()
                            .map(|i| i.title.clone())
                            .unwrap_or_else(|| "Radio internetowe".to_string());
                        (station, tag.trim().to_string())
                    };

                    let station_album = current_track
                        .as_ref()
                        .map(|i| i.title.clone())
                        .unwrap_or_else(|| "Radio internetowe".to_string());

                    if let Some(mpris) = &state.mpris {
                        let m = mpris.clone();
                        let t_c = parsed_title.clone();
                        let a_c = parsed_artist.clone();
                        let al_c = station_album.clone();
                        state.rt.spawn(async move {
                            let track_info = desktop_integration::MprisTrackInfo {
                                title: t_c,
                                artist: a_c,
                                album: al_c,
                                duration_ms: 0,
                                art_url: None,
                            };
                            m.update_track(track_info).await;
                        });
                    }
                    if let Some(discord) = &state.discord_rpc {
                        let cache_key = format!(
                            "{}---{}",
                            parsed_artist.trim().to_lowercase(),
                            parsed_title.trim().to_lowercase()
                        );
                        let cached_art = state
                            .discord_cover_cache
                            .read()
                            .ok()
                            .and_then(|c| c.get(&cache_key).cloned());

                        discord.update_track(desktop_integration::DiscordTrackInfo {
                            title: parsed_title.clone(),
                            artist: parsed_artist.clone(),
                            album: station_album.clone(),
                            duration_ms: 0,
                            art_url: cached_art.clone(),
                        });

                        if cached_art.is_none()
                            && !parsed_artist.trim().is_empty()
                            && !parsed_title.trim().is_empty()
                        {
                            let discord_clone = discord.clone();
                            let cover_archive = state.cover_archive.clone();
                            let cache_clone = state.discord_cover_cache.clone();
                            let title_c = parsed_title.clone();
                            let artist_c = parsed_artist.clone();
                            let album_c = station_album.clone();
                            state.rt.spawn(async move {
                                let candidates = cover_archive
                                    .search_cover_candidates(&title_c, &artist_c)
                                    .await;
                                if let Some(first) = candidates.first() {
                                    let best_url = if !first.thumbnail_url.is_empty() {
                                        first.thumbnail_url.clone()
                                    } else {
                                        first.full_url.clone()
                                    };
                                    if best_url.starts_with("http://")
                                        || best_url.starts_with("https://")
                                    {
                                        if let Ok(mut cache) = cache_clone.write() {
                                            cache.insert(cache_key, best_url.clone());
                                        }
                                        discord_clone.update_track(
                                            desktop_integration::DiscordTrackInfo {
                                                title: title_c,
                                                artist: artist_c,
                                                album: album_c,
                                                duration_ms: 0,
                                                art_url: Some(best_url),
                                            },
                                        );
                                    }
                                }
                            });
                        }
                    }
                } else {
                    if let Ok(mut t) = state.latest_live_stream_tag.lock() {
                        *t = None;
                    }
                }
            }
            _ => {}
        }
    }
    let pos_ms = state
        .engine
        .position()
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let dur_ms = state.engine.duration().map(|d| d.as_millis() as u64);

    let prev_pos = state
        .last_reported_pos_ms
        .swap(pos_ms, std::sync::atomic::Ordering::Relaxed);
    if state.engine.state() == PlaybackState::Playing {
        let is_loop_restart = prev_pos > 3000 && pos_ms < 2500;
        let is_major_rewind = prev_pos > pos_ms + 4000;
        if is_loop_restart || is_major_rewind {
            info!(
                "Wykryto cofnięcie/zapętlenie pozycji z {} ms do {} ms — synchronizuję Discord RPC i MPRIS",
                prev_pos, pos_ms
            );
            if let Some(discord) = &state.discord_rpc {
                let dur = dur_ms.unwrap_or(0);
                discord.update_playback_status(PlaybackState::Playing, pos_ms, dur);
            }
            if let Some(mpris) = &state.mpris {
                let m = mpris.clone();
                state.rt.spawn(async move {
                    m.emit_seeked(pos_ms).await;
                });
            }
        }
    }

    let dsp = state.engine.dsp_params();
    let capabilities = state.engine.dsp_capabilities();

    let should_update_waybar = if let Ok(mut last_t) = state.last_waybar_write.lock() {
        if last_t.elapsed() >= Duration::from_millis(500) {
            *last_t = std::time::Instant::now();
            true
        } else {
            false
        }
    } else {
        false
    };

    if should_update_waybar {
        let (title, artist, album) = if let Some(ref item) = current_track {
            (
                item.title.clone(),
                if item.artist.is_empty() {
                    "Unknown Artist".to_string()
                } else {
                    item.artist.clone()
                },
                item.album.clone().unwrap_or_default(),
            )
        } else {
            (
                "No Track".to_string(),
                "Auralune".to_string(),
                String::new(),
            )
        };

        let current_state = state.engine.state();
        let state_str = match current_state {
            PlaybackState::Playing => "Playing",
            PlaybackState::Paused => "Paused",
            PlaybackState::Stopped => "Stopped",
        };
        let class_str = match current_state {
            PlaybackState::Playing => "playing",
            PlaybackState::Paused => "paused",
            PlaybackState::Stopped => "stopped",
        };

        let percentage = if let Some(d) = dur_ms {
            if d > 0 {
                ((pos_ms as f64 / d as f64) * 100.0).clamp(0.0, 100.0) as u8
            } else {
                0
            }
        } else {
            0
        };

        let vol_pct = (state.engine.volume() * 100.0).clamp(0.0, 100.0) as u8;

        let text = if current_state == PlaybackState::Stopped || title == "No Track" {
            "Auralune: Stopped".to_string()
        } else {
            format!("{} - {}", artist, title)
        };

        let tooltip = format!(
            "{}\n{}\n{}\nStatus: {} | Vol: {}%",
            title, artist, album, state_str, vol_pct
        );

        let waybar = desktop_integration::WaybarStatus {
            text,
            alt: class_str.to_string(),
            tooltip,
            class: class_str.to_string(),
            percentage,
            volume: vol_pct,
            art_url: None,
            title,
            artist,
            album,
            state: state_str.to_string(),
            position_ms: pos_ms,
            duration_ms: dur_ms.unwrap_or(0),
        };

        let _ = desktop_integration::write_waybar_status(&waybar);
    }

    let spectrum = state
        .latest_spectrum
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default();
    let live_stream_title = if is_live_stream {
        state
            .latest_live_stream_tag
            .lock()
            .ok()
            .and_then(|t| t.clone())
    } else {
        if let Ok(mut t) = state.latest_live_stream_tag.lock() {
            if t.is_some() {
                *t = None;
            }
        }
        None
    };

    PlaybackStatusDto {
        state: state.engine.state(),
        position_ms: pos_ms,
        duration_ms: dur_ms,
        volume: state.engine.volume(),
        pitch_semitones: dsp.pitch_semitones,
        tempo_ratio: dsp.tempo_ratio,
        rate_ratio: dsp.rate_ratio,
        engine: dsp.engine,
        capabilities,
        loop_mode: q.loop_mode,
        shuffle: q.shuffle,
        stop_after_current: state.engine.stop_after_current(),
        current_track,
        equalizer_enabled: state.engine.is_equalizer_enabled(),
        equalizer_bands: state.engine.get_equalizer_bands(),
        parametric_eq_enabled: state.engine.is_parametric_eq_enabled(),
        compressor_enabled: state.engine.is_compressor_enabled(),
        saturator_enabled: state.engine.is_saturator_enabled(),
        limiter_enabled: state.engine.is_limiter_enabled(),
        spectrum,
        replaygain_config: state.engine.replaygain_config(),
        replaygain_status: state.engine.replaygain_status(),
        live_stream_title,
        is_stems_active: state.engine.is_stems_active(),
        active_stem_project_id: state.engine.active_stem_project_id(),
    }
}

// ----------------------------------------------------------------------------
// Tauri Command Handlers
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn load_file(path: String, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: load_file('{}')", path);
    state.engine.load_uri(&path).map_err(|e| e.to_string())?;

    if let Ok(mut t) = state.latest_live_stream_tag.lock() {
        *t = None;
    }

    let queue_item = resolve_queue_item(&path, &state).await;

    state.engine.set_active_item(queue_item.clone());
    sync_mpris_from_queue_item(&queue_item, &state);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
pub fn play(state: State<'_, AppState>) -> Result<(), String> {
    play_internal(&state)
}

#[tauri::command]
pub fn pause(state: State<'_, AppState>) -> Result<(), String> {
    pause_internal(&state)
}

#[tauri::command]
pub fn stop(state: State<'_, AppState>) -> Result<(), String> {
    stop_internal(&state)
}

#[tauri::command]
pub fn seek(
    position_ms: u64,
    fade: Option<bool>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    seek_internal(&state, position_ms, fade)
}

#[tauri::command]
pub fn set_volume(volume: f64, state: State<'_, AppState>) -> Result<(), String> {
    state.engine.set_volume(volume).map_err(|e| e.to_string())?;
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_volume(volume).await;
        });
    }
    Ok(())
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> PlaybackStatusDto {
    get_status_internal(&state)
}

#[tauri::command]
pub fn update_mpris_metadata(
    title: String,
    artist: String,
    album: String,
    duration_ms: u64,
    art_url: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let normalized_art = normalize_art_url(art_url.as_deref());

    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        let t_clone = title.clone();
        let a_clone = artist.clone();
        let al_clone = album.clone();
        let art_clone = normalized_art.clone();
        state.rt.spawn(async move {
            m.update_track(desktop_integration::MprisTrackInfo {
                title: t_clone,
                artist: a_clone,
                album: al_clone,
                duration_ms,
                art_url: art_clone,
            })
            .await;
        });
    }
    if let Some(discord) = &state.discord_rpc {
        let is_generic_album = album.trim().is_empty()
            || album == "Auralune Player"
            || album == "Auralune Library"
            || album == "Live Stream"
            || album == "Radio internetowe";

        let mut effective_artist = artist.trim().to_string();
        let mut effective_title = title.trim().to_string();
        if (effective_artist == "Plik lokalny" || effective_artist.is_empty())
            && effective_title.contains(" - ")
        {
            if let Some((a, t)) = effective_title.split_once(" - ") {
                effective_artist = a.trim().to_string();
                effective_title = t.trim().to_string();
            }
        }

        let cache_key = if !is_generic_album {
            format!(
                "{}---{}",
                effective_artist.trim().to_lowercase(),
                album.trim().to_lowercase()
            )
        } else {
            format!(
                "{}---{}",
                effective_artist.trim().to_lowercase(),
                effective_title.trim().to_lowercase()
            )
        };

        let effective_discord_art = if let Some(art) = &normalized_art {
            if art.starts_with("http://") || art.starts_with("https://") {
                if let Ok(mut cache) = state.discord_cover_cache.write() {
                    if !cache_key.is_empty() {
                        cache.insert(cache_key.clone(), art.clone());
                    }
                }
                Some(art.clone())
            } else {
                state.discord_cover_cache.read().ok().and_then(|cache| {
                    cache.get(&cache_key).cloned().or_else(|| {
                        let title_key = format!(
                            "{}---{}",
                            effective_artist.trim().to_lowercase(),
                            effective_title.trim().to_lowercase()
                        );
                        cache.get(&title_key).cloned()
                    })
                })
            }
        } else {
            state.discord_cover_cache.read().ok().and_then(|cache| {
                cache.get(&cache_key).cloned().or_else(|| {
                    let title_key = format!(
                        "{}---{}",
                        effective_artist.trim().to_lowercase(),
                        effective_title.trim().to_lowercase()
                    );
                    cache.get(&title_key).cloned()
                })
            })
        };

        discord.update_track(desktop_integration::DiscordTrackInfo {
            title: title.clone(),
            artist: artist.clone(),
            album: album.clone(),
            duration_ms,
            art_url: effective_discord_art.clone(),
        });
        let cur_state = state.engine.state();
        let effective_state = if cur_state == PlaybackState::Stopped {
            PlaybackState::Playing
        } else {
            cur_state
        };
        let pos = state
            .engine
            .position()
            .map(|p| p.as_millis() as u64)
            .unwrap_or(0);
        let dur = if duration_ms > 0 {
            duration_ms
        } else {
            state
                .engine
                .duration()
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0)
        };
        discord.update_playback_status(effective_state, pos, dur);

        let needs_online_search = effective_discord_art.is_none();

        if needs_online_search
            && (!effective_artist.trim().is_empty()
                || !album.trim().is_empty()
                || !effective_title.trim().is_empty())
        {
            let discord_clone = discord.clone();
            let cover_archive = state.cover_archive.clone();
            let cache_clone = state.discord_cover_cache.clone();
            let title_c = effective_title.clone();
            let artist_c = effective_artist.clone();
            let album_c = album.clone();
            state.rt.spawn(async move {
                let mut candidates = if !is_generic_album {
                    cover_archive
                        .search_cover_candidates(&album_c, &artist_c)
                        .await
                } else {
                    Vec::new()
                };
                if candidates.is_empty() && !title_c.trim().is_empty() {
                    candidates = cover_archive
                        .search_cover_candidates(&title_c, &artist_c)
                        .await;
                }
                if let Some(first) = candidates.first() {
                    let best_url = if !first.thumbnail_url.is_empty() {
                        first.thumbnail_url.clone()
                    } else {
                        first.full_url.clone()
                    };
                    if best_url.starts_with("http://") || best_url.starts_with("https://") {
                        if let Ok(mut cache) = cache_clone.write() {
                            cache.insert(cache_key, best_url.clone());
                        }
                        discord_clone.update_track(desktop_integration::DiscordTrackInfo {
                            title: title_c,
                            artist: artist_c,
                            album: album_c,
                            duration_ms,
                            art_url: Some(best_url),
                        });
                    }
                }
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_default_music_dir() -> Result<String, String> {
    if let Ok(home) = std::env::var("HOME") {
        let music = Path::new(&home).join("Music");
        if music.exists() {
            return Ok(music.to_string_lossy().to_string());
        }
        let downloads = Path::new(&home).join("Downloads");
        if downloads.exists() {
            return Ok(downloads.to_string_lossy().to_string());
        }
        return Ok(home);
    }
    Ok("/tmp".to_string())
}

#[tauri::command]
pub fn get_sample_track(app: tauri::AppHandle) -> Result<Option<SampleTrackDto>, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    Ok(resolve_or_extract_sample_track(&data_dir))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_playback_state_noop_on_none_controllers() {
        assert_ne!(PlaybackState::Playing, PlaybackState::Stopped);
        assert_ne!(PlaybackState::Paused, PlaybackState::Stopped);
    }

    #[test]
    fn test_is_supported_audio() {
        assert!(is_supported_audio("test.flac"));
        assert!(is_supported_audio("test.mp3"));
        assert!(!is_supported_audio("test.txt"));
    }

    #[test]
    fn test_is_supported_audio_formats() {
        assert!(is_supported_audio("song.mp3"));
        assert!(is_supported_audio("music/track.flac"));
        assert!(is_supported_audio("test.opus"));
        assert!(is_supported_audio("album/track.wav"));
        assert!(is_supported_audio("stream.ogg"));
        assert!(is_supported_audio("audio.m4a"));
        assert!(is_supported_audio("audio.aac"));
        assert!(is_supported_audio("audio.alac"));
        assert!(is_supported_audio("audio.aiff"));
        assert!(is_supported_audio("playlist.m3u"));
        assert!(is_supported_audio("playlist.m3u8"));
        assert!(is_supported_audio("sheet.cue"));

        // Case insensitivity
        assert!(is_supported_audio("SONG.FLAC"));
        assert!(is_supported_audio("track.OpUs"));

        // Unsupported files
        assert!(!is_supported_audio("document.pdf"));
        assert!(!is_supported_audio("picture.png"));
        assert!(!is_supported_audio("video.mp4"));
        assert!(!is_supported_audio("archive.zip"));
        assert!(!is_supported_audio("no_extension"));
    }

    #[test]
    fn test_normalize_path_or_url_http() {
        assert_eq!(
            normalize_path_or_url("https://stream.example.com/live.opus", None),
            Some("https://stream.example.com/live.opus".to_string())
        );
        assert_eq!(
            normalize_path_or_url("http://radio.anime.org/stream", None),
            Some("http://radio.anime.org/stream".to_string())
        );
        assert_eq!(normalize_path_or_url("   ", None), None);
    }

    #[test]
    fn test_extract_audio_paths_from_args() {
        let args = vec![
            "auralune".to_string(),
            "--bazzite".to_string(),
            "-v".to_string(),
            "https://stream.anime.fm/live".to_string(),
        ];
        let extracted = extract_audio_paths_from_args(&args, None);
        assert_eq!(extracted.len(), 1);
        assert_eq!(extracted[0], "https://stream.anime.fm/live");
    }
}
