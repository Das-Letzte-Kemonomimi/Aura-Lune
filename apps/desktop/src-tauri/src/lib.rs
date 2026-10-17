//! Backend desktopowy Auralune (Tauri 2).
//!
//! ZGODNIE Z ZASADĄ ARCHITEKTONICZNĄ:
//! Wątek audio i surowe próbki PCM są całkowicie odizolowane od WebView i bazy danych.
//! Komendy Tauri służą wyłącznie do sterowania odtwarzaczem, odpytywania stanu i indeksowania.

use audio_engine::{AudioEngine, DeviceManager, Transcoder};
use domain::device::{AudioCard, BluetoothCodec};
use domain::queue::{LoopMode, PlaybackQueue, QueueItem};
use domain::transcode::ExportFormat;
use domain::{PlaybackState, Playlist, Theme};
use dsp_api::{DspCapabilities, DspEngine, DspParams};
use library::LibraryScanner;
use metadata::{CoverArtArchiveClient, MusicBrainzClient, ReleaseCandidateDto};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use storage::{AlbumRecord, ArtistRecord, Database, DspPresetRecord, TrackRecord};
use tauri::{Manager, State};
use tracing::{error, info};

pub struct AppState {
    pub engine: Arc<AudioEngine>,
    pub db: Arc<Database>,
    pub scanner: Arc<LibraryScanner>,
    pub rt: Arc<tokio::runtime::Runtime>,
    pub mpris: Option<Arc<desktop_integration::MprisController>>,
    pub mb: Arc<MusicBrainzClient>,
    pub cover_archive: Arc<CoverArtArchiveClient>,
}

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
    pub current_track: Option<QueueItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummaryDto {
    pub total_files_found: usize,
    pub new_or_updated_tracks: usize,
    pub skipped_unchanged: usize,
    pub errors: usize,
}

#[tauri::command]
fn load_file(path: String, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: load_file('{}')", path);
    state.engine.load_uri(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn play(state: State<'_, AppState>) -> Result<(), String> {
    state.engine.play().map_err(|e| e.to_string())?;
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_playback_status(PlaybackState::Playing).await;
        });
    }
    Ok(())
}

#[tauri::command]
fn pause(state: State<'_, AppState>) -> Result<(), String> {
    state.engine.pause().map_err(|e| e.to_string())?;
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_playback_status(PlaybackState::Paused).await;
        });
    }
    Ok(())
}

#[tauri::command]
fn stop(state: State<'_, AppState>) -> Result<(), String> {
    state.engine.stop().map_err(|e| e.to_string())?;
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_playback_status(PlaybackState::Stopped).await;
        });
    }
    Ok(())
}

#[tauri::command]
fn seek(position_ms: u64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .engine
        .seek(Duration::from_millis(position_ms))
        .map_err(|e| e.to_string())?;
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.emit_seeked(position_ms).await;
        });
    }
    Ok(())
}

#[tauri::command]
fn set_pitch(semitones: f64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .engine
        .set_pitch_semitones(semitones)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_tempo(tempo_ratio: f64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .engine
        .set_tempo_ratio(tempo_ratio)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_rate(rate_ratio: f64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .engine
        .set_rate_ratio(rate_ratio)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn reset_dsp(state: State<'_, AppState>) -> Result<PlaybackStatusDto, String> {
    let current = state.engine.dsp_params();
    let reset_params = DspParams::new(current.engine, 0.0, 1.0, 1.0).map_err(|e| e.to_string())?;
    state
        .engine
        .set_dsp_params(reset_params)
        .map_err(|e| e.to_string())?;
    Ok(get_status(state))
}

#[tauri::command]
fn set_dsp_engine(
    engine: DspEngine,
    state: State<'_, AppState>,
) -> Result<PlaybackStatusDto, String> {
    info!("Tauri command: set_dsp_engine({:?})", engine);
    state
        .engine
        .set_dsp_engine(engine)
        .map_err(|e| e.to_string())?;
    Ok(get_status(state))
}

#[tauri::command]
fn get_dsp_capabilities(state: State<'_, AppState>) -> DspCapabilities {
    state.engine.dsp_capabilities()
}

#[tauri::command]
fn save_dsp_preset(name: String, state: State<'_, AppState>) -> Result<i64, String> {
    let dsp = state.engine.dsp_params();
    let db = state.db.clone();
    let engine_str = match dsp.engine {
        DspEngine::SoundTouch => "SoundTouch",
        DspEngine::RubberBand => "RubberBand",
    };

    state
        .rt
        .block_on(async move {
            db.save_dsp_preset(
                &name,
                engine_str,
                dsp.pitch_semitones,
                dsp.tempo_ratio,
                dsp.rate_ratio,
            )
            .await
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_dsp_presets(state: State<'_, AppState>) -> Result<Vec<DspPresetRecord>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_dsp_presets().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn load_dsp_preset(
    preset: DspPresetRecord,
    state: State<'_, AppState>,
) -> Result<PlaybackStatusDto, String> {
    let engine = if preset.engine.eq_ignore_ascii_case("RubberBand") {
        DspEngine::RubberBand
    } else {
        DspEngine::SoundTouch
    };

    let params = DspParams::new(
        engine,
        preset.pitch_semitones,
        preset.tempo_ratio,
        preset.rate_ratio,
    )
    .map_err(|e| e.to_string())?;

    state
        .engine
        .set_dsp_params(params)
        .map_err(|e| e.to_string())?;
    Ok(get_status(state))
}

#[tauri::command]
fn set_volume(volume: f64, state: State<'_, AppState>) -> Result<(), String> {
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
fn update_mpris_metadata(
    title: String,
    artist: String,
    album: String,
    duration_ms: u64,
    art_url: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.update_track(desktop_integration::MprisTrackInfo {
                title,
                artist,
                album,
                duration_ms,
                art_url,
            })
            .await;
        });
    }
    Ok(())
}

#[tauri::command]
fn get_status(state: State<'_, AppState>) -> PlaybackStatusDto {
    let _ = state.engine.poll_events();
    let pos_ms = state
        .engine
        .position()
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let dur_ms = state.engine.duration().map(|d| d.as_millis() as u64);
    let dsp = state.engine.dsp_params();
    let capabilities = state.engine.dsp_capabilities();

    let q = state.engine.queue();
    let current_track = q.current_item().cloned();

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
        current_track,
    }
}

#[tauri::command]
fn list_devices() -> Result<Vec<AudioCard>, String> {
    DeviceManager::list_cards().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_device_profile(card_name: String, profile_name: String) -> Result<(), String> {
    DeviceManager::set_card_profile(&card_name, &profile_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_bluetooth_codec(card_name: String, codec: BluetoothCodec) -> Result<(), String> {
    DeviceManager::set_bluetooth_codec(&card_name, &codec).map_err(|e| e.to_string())
}

#[tauri::command]
fn enable_pro_audio(card_name: String) -> Result<(), String> {
    DeviceManager::enable_pro_audio(&card_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn transcode_file(
    input_path: String,
    output_path: String,
    format: ExportFormat,
) -> Result<(), String> {
    Transcoder::transcode(&input_path, &output_path, format).map_err(|e| e.to_string())
}

#[tauri::command]
fn scan_library(folder_path: String, state: State<'_, AppState>) -> Result<ScanSummaryDto, String> {
    info!("Tauri command: scan_library('{}')", folder_path);
    let scanner = state.scanner.clone();
    let db = state.db.clone();

    let summary = state
        .rt
        .block_on(async move { scanner.scan_directory(&folder_path, &db).await })
        .map_err(|e| e.to_string())?;

    Ok(ScanSummaryDto {
        total_files_found: summary.total_files_found,
        new_or_updated_tracks: summary.new_or_updated_tracks,
        skipped_unchanged: summary.skipped_unchanged,
        errors: summary.errors,
    })
}

#[tauri::command]
fn get_library_tracks(state: State<'_, AppState>) -> Result<Vec<TrackRecord>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_tracks().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_library_albums(state: State<'_, AppState>) -> Result<Vec<AlbumRecord>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_albums().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_library_artists(state: State<'_, AppState>) -> Result<Vec<ArtistRecord>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_artists().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_bookmark(
    track_id: i64,
    position_ms: u64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.save_bookmark(track_id, position_ms).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_bookmark(track_id: i64, state: State<'_, AppState>) -> Result<Option<u64>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.get_bookmark(track_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_themes(state: State<'_, AppState>) -> Result<Vec<Theme>, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.list_themes().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_active_theme(state: State<'_, AppState>) -> Result<Theme, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let active_id = db
                .get_app_setting("active_theme_id")
                .await?
                .unwrap_or_else(|| "cyber-kitsune".to_string());
            if let Some(theme) = db.get_theme(&active_id).await? {
                Ok(theme)
            } else {
                db.get_theme("cyber-kitsune").await?.ok_or_else(|| {
                    storage::StorageError::Migration("Nie znaleziono domyślnego motywu".to_string())
                })
            }
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
fn set_active_theme(theme_id: String, state: State<'_, AppState>) -> Result<Theme, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let theme = db.get_theme(&theme_id).await?.ok_or_else(|| {
                storage::StorageError::Migration(format!("Motyw '{}' nie istnieje", theme_id))
            })?;
            db.set_app_setting("active_theme_id", &theme_id).await?;
            Ok(theme)
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
fn save_theme(theme: Theme, state: State<'_, AppState>) -> Result<(), String> {
    theme.validate()?;
    let db = state.db.clone();
    state
        .rt
        .block_on(async move { db.save_theme(&theme).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_theme_background(
    theme_id: String,
    background_ref: Option<String>,
    overlay_opacity: f32,
    blur_radius: f32,
    state: State<'_, AppState>,
) -> Result<Theme, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let mut theme = db.get_theme(&theme_id).await?.ok_or_else(|| {
                storage::StorageError::Migration(format!("Motyw '{}' nie istnieje", theme_id))
            })?;
            theme.background_ref = background_ref;
            theme.overlay_opacity = overlay_opacity;
            theme.blur_radius = blur_radius;
            theme.validate().map_err(storage::StorageError::Migration)?;
            db.save_theme(&theme).await?;
            Ok(theme)
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
fn export_theme_json(theme_id: String, state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.clone();
    state
        .rt
        .block_on(async move {
            let theme = db.get_theme(&theme_id).await?.ok_or_else(|| {
                storage::StorageError::Migration(format!("Motyw '{}' nie istnieje", theme_id))
            })?;
            serde_json::to_string_pretty(&theme)
                .map_err(|e| storage::StorageError::Migration(e.to_string()))
        })
        .map_err(|e: storage::StorageError| e.to_string())
}

#[tauri::command]
fn import_theme_json(json_content: String, state: State<'_, AppState>) -> Result<Theme, String> {
    let theme: Theme =
        serde_json::from_str(&json_content).map_err(|e| format!("Błąd parsowania JSON: {}", e))?;
    theme.validate()?;
    let db = state.db.clone();
    let theme_clone = theme.clone();
    state
        .rt
        .block_on(async move {
            db.save_theme(&theme_clone).await?;
            db.set_app_setting("active_theme_id", &theme_clone.id)
                .await?;
            Ok::<(), storage::StorageError>(())
        })
        .map_err(|e| e.to_string())?;
    Ok(theme)
}

#[tauri::command]
fn upload_background_image(file_path: String) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("Wskazany plik nie istnieje".to_string());
    }
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => return Err("Obsługiwane są wyłącznie pliki graficzne PNG, JPG lub WebP".to_string()),
    };

    let bytes = std::fs::read(path).map_err(|e| format!("Błąd odczytu pliku: {}", e))?;
    if bytes.len() > 15 * 1024 * 1024 {
        return Err("Plik graficzny jest zbyt duży (maks. 15 MB)".to_string());
    }

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn search_musicbrainz_releases(
    album: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<Vec<ReleaseCandidateDto>, String> {
    info!(
        "Tauri command: search_musicbrainz_releases('{}', '{}')",
        album, artist
    );
    let mb = state.mb.clone();
    state
        .rt
        .block_on(async move { mb.search_releases(&album, &artist).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn fetch_and_apply_cover(
    album_id: i64,
    mbid: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!(
        "Tauri command: fetch_and_apply_cover(album_id: {}, mbid: '{}')",
        album_id, mbid
    );
    let cover_archive = state.cover_archive.clone();
    let db = state.db.clone();

    state.rt.block_on(async move {
        let path = cover_archive
            .fetch_and_cache_cover(&mbid)
            .await
            .map_err(|e| e.to_string())?;
        let path_str = path.to_string_lossy().to_string();

        db.update_album_cover(album_id, &path_str, Some(&mbid))
            .await
            .map_err(|e| e.to_string())?;

        let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        Ok(format!("data:image/jpeg;base64,{}", b64))
    })
}

#[tauri::command]
fn auto_fetch_album_cover(
    album_id: i64,
    album_title: String,
    artist: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    info!(
        "Tauri command: auto_fetch_album_cover('{}', '{}')",
        album_title, artist
    );
    let mb = state.mb.clone();
    let cover_archive = state.cover_archive.clone();
    let db = state.db.clone();

    state.rt.block_on(async move {
        let candidates = mb
            .search_releases(&album_title, &artist)
            .await
            .map_err(|e| e.to_string())?;
        if candidates.is_empty() {
            return Ok(None);
        }

        let best = &candidates[0];
        if best.score >= 85 {
            match cover_archive.fetch_and_cache_cover(&best.mbid).await {
                Ok(path) => {
                    let path_str = path.to_string_lossy().to_string();
                    db.update_album_cover(album_id, &path_str, Some(&best.mbid))
                        .await
                        .map_err(|e| e.to_string())?;

                    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
                    use base64::Engine;
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    return Ok(Some(format!("data:image/jpeg;base64,{}", b64)));
                }
                Err(e) => {
                    tracing::warn!("Nie udało się pobrać okładki dla MBID {}: {}", best.mbid, e);
                }
            }
        }

        Ok(None)
    })
}

fn sync_mpris_from_queue_item(item: &QueueItem, state: &AppState) {
    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        let track_info = desktop_integration::MprisTrackInfo {
            title: item.title.clone(),
            artist: item.artist.clone(),
            album: item.album.clone().unwrap_or_default(),
            duration_ms: item.duration_ms,
            art_url: None,
        };
        state.rt.spawn(async move {
            m.update_track(track_info).await;
            m.update_playback_status(PlaybackState::Playing).await;
        });
    }
}

fn persist_queue_state(state: &AppState) {
    let queue = state.engine.queue();
    let db = state.db.clone();
    state.rt.spawn(async move {
        if let Err(e) = db.save_queue_state(&queue).await {
            tracing::warn!("Nie udało się zapisać stanu kolejki: {}", e);
        }
    });
}

#[tauri::command]
fn get_queue(state: State<'_, AppState>) -> PlaybackQueue {
    state.engine.queue()
}

#[tauri::command]
fn set_queue(
    items: Vec<QueueItem>,
    start_index: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Option<QueueItem>, String> {
    info!("Tauri command: set_queue ({} utworów)", items.len());
    let active = state
        .engine
        .set_queue(items, start_index)
        .map_err(|e| e.to_string())?;
    if let Some(item) = &active {
        sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(active)
}

#[tauri::command]
fn add_to_queue(item: QueueItem, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: add_to_queue('{}')", item.title);
    state.engine.add_to_queue(item);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
fn add_next_to_queue(item: QueueItem, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: add_next_to_queue('{}')", item.title);
    state.engine.add_next_to_queue(item);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
fn remove_from_queue(id: String, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: remove_from_queue('{}')", id);
    state.engine.remove_from_queue(&id);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
fn reorder_queue(
    from_idx: usize,
    to_idx: usize,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    info!("Tauri command: reorder_queue({} -> {})", from_idx, to_idx);
    let res = state.engine.move_in_queue(from_idx, to_idx);
    persist_queue_state(&state);
    Ok(res)
}

#[tauri::command]
fn clear_queue(state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: clear_queue()");
    state.engine.clear_queue();
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
fn play_queue_index(index: usize, state: State<'_, AppState>) -> Result<Option<QueueItem>, String> {
    info!("Tauri command: play_queue_index({})", index);
    let active = state.engine.play_index(index).map_err(|e| e.to_string())?;
    if let Some(item) = &active {
        sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(active)
}

#[tauri::command]
fn play_next(state: State<'_, AppState>) -> Result<Option<QueueItem>, String> {
    info!("Tauri command: play_next()");
    let next_item = state.engine.play_next().map_err(|e| e.to_string())?;
    if let Some(item) = &next_item {
        sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(next_item)
}

#[tauri::command]
fn play_previous(state: State<'_, AppState>) -> Result<Option<QueueItem>, String> {
    info!("Tauri command: play_previous()");
    let prev_item = state.engine.play_previous().map_err(|e| e.to_string())?;
    if let Some(item) = &prev_item {
        sync_mpris_from_queue_item(item, &state);
    }
    persist_queue_state(&state);
    Ok(prev_item)
}

#[tauri::command]
fn set_loop_mode(mode: LoopMode, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: set_loop_mode({:?})", mode);
    state.engine.set_loop_mode(mode);
    persist_queue_state(&state);
    Ok(())
}

#[tauri::command]
fn toggle_shuffle(state: State<'_, AppState>) -> Result<bool, String> {
    let current = state.engine.shuffle();
    let new_val = !current;
    info!("Tauri command: toggle_shuffle({} -> {})", current, new_val);
    state.engine.set_shuffle(new_val);
    persist_queue_state(&state);
    Ok(new_val)
}

#[tauri::command]
fn create_playlist(name: String, state: State<'_, AppState>) -> Result<i64, String> {
    info!("Tauri command: create_playlist('{}')", name);
    state
        .rt
        .block_on(async { state.db.create_playlist(&name).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_playlist(playlist_id: i64, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: delete_playlist({})", playlist_id);
    state
        .rt
        .block_on(async { state.db.delete_playlist(playlist_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>, String> {
    state
        .rt
        .block_on(async { state.db.list_playlists().await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_track_to_playlist(
    playlist_id: i64,
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!(
        "Tauri command: add_track_to_playlist(playlist: {}, track: {})",
        playlist_id, track_id
    );
    state
        .rt
        .block_on(async { state.db.add_track_to_playlist(playlist_id, track_id).await })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_track_from_playlist(
    playlist_id: i64,
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!(
        "Tauri command: remove_track_from_playlist(playlist: {}, track: {})",
        playlist_id, track_id
    );
    state
        .rt
        .block_on(async {
            state
                .db
                .remove_track_from_playlist(playlist_id, track_id)
                .await
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_playlist_tracks(
    playlist_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<TrackRecord>, String> {
    state
        .rt
        .block_on(async { state.db.get_playlist_tracks(playlist_id).await })
        .map_err(|e| e.to_string())
}

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let rt = Arc::new(tokio::runtime::Runtime::new().expect("Błąd tworzenia runtime tokio"));

    let engine = match AudioEngine::new() {
        Ok(e) => Arc::new(e),
        Err(err) => {
            error!("Nie udało się zainicjalizować silnika audio: {:?}", err);
            panic!("Krytyczny błąd silnika audio: {:?}", err);
        }
    };

    tauri::Builder::default()
        .setup({
            let rt = rt.clone();
            let engine = engine.clone();
            move |app| {
                let data_dir = app
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| PathBuf::from("."));
                let _ = fs::create_dir_all(&data_dir);
                let db_path = data_dir.join("auralune_library.db");
                let cache_dir = data_dir.join("cache");

                let db = rt.block_on(async {
                    Database::open(&db_path)
                        .await
                        .expect("Błąd otwarcia bazy SQLite")
                });

                // Przywrócenie ostatniego stanu kolejki odtwarzania z bazy danych
                if let Ok(Some(saved_queue)) = rt.block_on(async { db.load_queue_state().await }) {
                    info!(
                        "Wczytano zapisany stan kolejki ({} utworów)",
                        saved_queue.items.len()
                    );
                    let loop_mode = saved_queue.loop_mode;
                    let shuffle = saved_queue.shuffle;
                    let items = saved_queue.items;
                    let current_index = saved_queue.current_index;
                    let _ = engine.set_queue(items, current_index);
                    engine.set_loop_mode(loop_mode);
                    engine.set_shuffle(shuffle);
                    let _ = engine.pause();
                }

                let scanner = LibraryScanner::new(&cache_dir);
                let mb = Arc::new(MusicBrainzClient::new());
                let cover_archive = Arc::new(CoverArtArchiveClient::new(&cache_dir));

                let mpris = rt.block_on(async {
                    match desktop_integration::MprisController::start(engine.clone()).await {
                        Ok(controller) => {
                            info!("Zainicjalizowano serwis MPRIS D-Bus: org.mpris.MediaPlayer2.auralune");
                            Some(Arc::new(controller))
                        }
                        Err(e) => {
                            tracing::warn!("MPRIS D-Bus niedostępny w tej sesji: {}", e);
                            None
                        }
                    }
                });

                let app_state = AppState {
                    engine,
                    db: Arc::new(db),
                    scanner: Arc::new(scanner),
                    rt,
                    mpris,
                    mb,
                    cover_archive,
                };

                app.manage(app_state);
                Ok(())
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_file,
            play,
            pause,
            stop,
            seek,
            set_pitch,
            set_tempo,
            set_rate,
            reset_dsp,
            set_dsp_engine,
            get_dsp_capabilities,
            save_dsp_preset,
            list_dsp_presets,
            load_dsp_preset,
            set_volume,
            get_status,
            list_devices,
            set_device_profile,
            set_bluetooth_codec,
            enable_pro_audio,
            transcode_file,
            scan_library,
            get_library_tracks,
            get_library_albums,
            get_library_artists,
            save_bookmark,
            get_bookmark,
            update_mpris_metadata,
            list_themes,
            get_active_theme,
            set_active_theme,
            save_theme,
            update_theme_background,
            export_theme_json,
            import_theme_json,
            upload_background_image,
            search_musicbrainz_releases,
            fetch_and_apply_cover,
            auto_fetch_album_cover,
            get_queue,
            set_queue,
            add_to_queue,
            add_next_to_queue,
            remove_from_queue,
            reorder_queue,
            clear_queue,
            play_queue_index,
            play_next,
            play_previous,
            set_loop_mode,
            toggle_shuffle,
            create_playlist,
            delete_playlist,
            list_playlists,
            add_track_to_playlist,
            remove_track_from_playlist,
            get_playlist_tracks,
        ])
        .run(tauri::generate_context!())
        .expect("Błąd podczas uruchamiania aplikacji Tauri");
}
