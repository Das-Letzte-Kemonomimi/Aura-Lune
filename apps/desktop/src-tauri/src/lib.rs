//! Backend desktopowy Auralune (Tauri 2).
//!
//! ZGODNIE Z ZASADĄ ARCHITEKTONICZNĄ:
//! Wątek audio i surowe próbki PCM są odizolowane od WebView.
//! Komendy Tauri służą wyłącznie do sterowania odtwarzaczem i odczytu statusu.

use audio_engine::{AudioEngine, DeviceManager, Transcoder};
use domain::device::{AudioCard, BluetoothCodec};
use domain::transcode::ExportFormat;
use domain::PlaybackState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tauri::State;
use tracing::{error, info};

pub struct AppState {
    pub engine: Arc<AudioEngine>,
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
}

#[tauri::command]
fn load_file(path: String, state: State<'_, AppState>) -> Result<(), String> {
    info!("Tauri command: load_file('{}')", path);
    state.engine.load_uri(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn play(state: State<'_, AppState>) -> Result<(), String> {
    state.engine.play().map_err(|e| e.to_string())
}

#[tauri::command]
fn pause(state: State<'_, AppState>) -> Result<(), String> {
    state.engine.pause().map_err(|e| e.to_string())
}

#[tauri::command]
fn stop(state: State<'_, AppState>) -> Result<(), String> {
    state.engine.stop().map_err(|e| e.to_string())
}

#[tauri::command]
fn seek(position_ms: u64, state: State<'_, AppState>) -> Result<(), String> {
    state
        .engine
        .seek(Duration::from_millis(position_ms))
        .map_err(|e| e.to_string())
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
fn set_volume(volume: f64, state: State<'_, AppState>) -> Result<(), String> {
    state.engine.set_volume(volume).map_err(|e| e.to_string())
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

    PlaybackStatusDto {
        state: state.engine.state(),
        position_ms: pos_ms,
        duration_ms: dur_ms,
        volume: state.engine.volume(),
        pitch_semitones: dsp.pitch_semitones,
        tempo_ratio: dsp.tempo_ratio,
        rate_ratio: dsp.rate_ratio,
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

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let engine = match AudioEngine::new() {
        Ok(e) => Arc::new(e),
        Err(err) => {
            error!("Nie udało się zainicjalizować silnika audio: {:?}", err);
            panic!("Krytyczny błąd silnika audio: {:?}", err);
        }
    };

    let app_state = AppState { engine };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            load_file,
            play,
            pause,
            stop,
            seek,
            set_pitch,
            set_tempo,
            set_volume,
            get_status,
            list_devices,
            set_device_profile,
            set_bluetooth_codec,
            enable_pro_audio,
            transcode_file,
        ])
        .run(tauri::generate_context!())
        .expect("Błąd podczas uruchamiania aplikacji Tauri");
}
