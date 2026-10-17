//! Backend desktopowy Auralune (Tauri 2).
//!
//! ZGODNIE Z ZASADĄ ARCHITEKTONICZNĄ:
//! Wątek audio i surowe próbki PCM są całkowicie odizolowane od WebView i bazy danych.
//! Komendy Tauri służą wyłącznie do sterowania odtwarzaczem, odpytywania stanu i indeksowania.

use audio_engine::{AudioEngine, DeviceManager, Transcoder};
use domain::device::{AudioCard, BluetoothCodec};
use domain::transcode::ExportFormat;
use domain::{PlaybackState, Theme};
use dsp_api::{DspCapabilities, DspEngine, DspParams};
use library::LibraryScanner;
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

                let scanner = LibraryScanner::new(&cache_dir);

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
        ])
        .run(tauri::generate_context!())
        .expect("Błąd podczas uruchamiania aplikacji Tauri");
}
