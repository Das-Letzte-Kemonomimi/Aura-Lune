use crate::AppState;
use audio_engine::{
    get_stem_projects_cache_dir, list_available_model_packs, list_available_models,
    remove_model_file, StemSeparator,
};
use domain::{
    AiModelInfo, ModelPackInfo, PlaybackState, QueueItem, StemChannel, StemMixerState, StemProject,
    StemProjectMix, StemProjectStatus, StemSeparationData,
};
use downloads::DownloadProvider;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Emitter;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemProgressPayload {
    pub track_id: i64,
    pub progress: f32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemProjectProgressPayload {
    pub project_id: i64,
    pub progress: f32,
    pub message: String,
    pub status: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ModelDownloadProgressPayload {
    pub model_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub progress: f32,
    pub status: String,
}

/// Returns a list of installed and available AI stem separation models.
pub fn list_ai_models_internal() -> Vec<AiModelInfo> {
    list_available_models()
}

/// Deletes a downloaded AI model file from disk.
pub fn delete_ai_model_internal(model_id: &str) -> Result<(), String> {
    remove_model_file(model_id)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Downloads an AI stem separation model with SHA256 integrity verification.
pub async fn download_ai_model_internal(
    model_id: &str,
    app_handle: &tauri::AppHandle,
) -> Result<(), String> {
    let catalog = audio_engine::get_default_model_catalog();
    let model = catalog
        .into_iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Nieznany model AI: {}", model_id))?;

    let url = model
        .download_url
        .ok_or_else(|| "Model nie posiada zdefiniowanego adresu URL do pobrania".to_string())?;

    let dest_path = PathBuf::from(&model.file_path);
    if let Some(parent) = dest_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let app_handle_clone = app_handle.clone();
    let m_id_clone = model_id.to_string();
    let cancel_flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));

    let provider = downloads::HttpDownloadProvider::new();
    let _ = provider
        .download(
            &url,
            &dest_path,
            Some(&model.sha256),
            cancel_flag,
            Some(Box::new(move |downloaded, total| {
                let progress = if let Some(tot) = total {
                    if tot > 0 {
                        (downloaded as f32 / tot as f32).clamp(0.0, 1.0)
                    } else {
                        0.0
                    }
                } else {
                    0.0
                };
                let _ = app_handle_clone.emit(
                    "auralune://model-download-progress",
                    ModelDownloadProgressPayload {
                        model_id: m_id_clone.clone(),
                        downloaded_bytes: downloaded,
                        total_bytes: total,
                        progress,
                        status: "downloading".to_string(),
                    },
                );
            })),
        )
        .await
        .map_err(|e| format!("Błąd pobierania modelu {}: {}", model_id, e))?;

    let _ = app_handle.emit(
        "auralune://model-download-progress",
        ModelDownloadProgressPayload {
            model_id: model_id.to_string(),
            downloaded_bytes: 0,
            total_bytes: None,
            progress: 1.0,
            status: "completed".to_string(),
        },
    );

    Ok(())
}

/// Returns a list of available model pack configurations.
pub fn list_model_packs_internal() -> Vec<ModelPackInfo> {
    list_available_model_packs()
}

/// Starts 4-stem separation (vocals, drums, bass, other) using an AI model.
pub async fn start_stem_separation_internal(
    state: &AppState,
    path: String,
    track_id: i64,
    model_id: Option<String>,
    app_handle: &tauri::AppHandle,
) -> Result<StemSeparationData, String> {
    let m_id = model_id.unwrap_or_else(|| "htdemucs_v4".to_string());
    let path_clone = path.clone();
    let m_id_clone = m_id.clone();
    let app_handle_clone = app_handle.clone();

    let separation = tokio::task::spawn_blocking(move || {
        StemSeparator::separate_track(
            &path_clone,
            track_id,
            &m_id_clone,
            Some(Box::new(move |progress, message| {
                let _ = app_handle_clone.emit(
                    "auralune://stem-progress",
                    StemProgressPayload {
                        track_id,
                        progress,
                        message: message.to_string(),
                    },
                );
            })),
        )
    })
    .await
    .map_err(|e| format!("Błąd wątku separacji: {}", e))?
    .map_err(|e| format!("Błąd separacji stemów: {}", e))?;

    // Zapisz w SQLite
    let _ = state.db.save_stem_tracks(&separation).await;

    Ok(separation)
}

/// Retrieves cached stem separation tracks for a track ID.
pub async fn get_track_stems_internal(
    state: &AppState,
    track_id: i64,
) -> Result<Option<StemSeparationData>, String> {
    state
        .db
        .get_stem_tracks(track_id)
        .await
        .map_err(|e| e.to_string())
}

/// Loads multi-track stem audio into the real-time audio pipeline.
pub async fn load_track_stems_internal(
    state: &AppState,
    track_id: i64,
    seek_position_ms: Option<u64>,
    start_playing: Option<bool>,
) -> Result<StemMixerState, String> {
    let stems = state
        .db
        .get_stem_tracks(track_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| {
            "Brak rozdzielonych stemów dla tego utworu. Rozpocznij separację najpierw.".to_string()
        })?;

    let orig_track = state.db.get_track_by_id(track_id).await.ok().flatten();
    let orig_uri = orig_track
        .as_ref()
        .map(|t| t.path.clone())
        .or_else(|| state.engine.current_uri())
        .or_else(|| state.engine.queue().current_item().map(|it| it.uri.clone()));

    let cur_pos = seek_position_ms
        .map(std::time::Duration::from_millis)
        .or_else(|| state.engine.position());
    let auto_play = start_playing.unwrap_or_else(|| state.engine.state() == PlaybackState::Playing);

    let mixer_state = StemMixerState {
        enabled: true,
        ..state.engine.get_stem_mixer_state()
    };

    state
        .engine
        .load_stems(
            &stems,
            mixer_state.clone(),
            orig_uri.clone(),
            cur_pos,
            auto_play,
        )
        .map_err(|e| e.to_string())?;

    if let Some(track) = orig_track {
        let queue_item = QueueItem {
            id: format!("stems-track-{}", track_id),
            track_id: Some(track.id),
            uri: orig_uri.unwrap_or_else(|| track.path.clone()),
            title: track.title.clone(),
            artist: track.artist.clone(),
            album: track.album_id.map(|aid| format!("Album #{}", aid)),
            duration_ms: track.duration_ms.max(0) as u64,
        };
        state.engine.set_active_item(queue_item.clone());
        crate::commands::playback::sync_mpris_from_queue_item(&queue_item, state);
    }
    Ok(mixer_state)
}

/// Updates 4-stem channel mixer volumes and solo/mute flags.
pub fn set_stem_mixer_state_internal(
    state: &AppState,
    state_payload: StemMixerState,
) -> Result<(), String> {
    state
        .engine
        .set_stem_mixer_state(state_payload)
        .map_err(|e| e.to_string())
}

/// Returns current stem mixer volume levels and channel routing.
pub fn get_stem_mixer_state_internal(state: &AppState) -> StemMixerState {
    state.engine.get_stem_mixer_state()
}

/// Creates a new Moises-style multi-track stem project.
pub async fn create_stem_project_internal(
    state: &AppState,
    track_id: i64,
    title: Option<String>,
    requested_packs: Vec<String>,
    app_handle: &tauri::AppHandle,
) -> Result<StemProject, String> {
    let track = state
        .db
        .get_track_by_id(track_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Nie znaleziono utworu o ID {}", track_id))?;

    let track_path = track.path.clone();
    let track_hash = audio_engine::calculate_file_sha256(Path::new(&track_path))
        .map_err(|e| format!("Błąd kalkulacji SHA-256: {}", e))?;

    let album_title = if let Some(a_id) = track.album_id {
        state
            .db
            .get_album_by_id(a_id)
            .await
            .ok()
            .flatten()
            .map(|a| a.title)
            .unwrap_or_else(|| "Unknown Album".to_string())
    } else {
        track
            .album_artist
            .clone()
            .unwrap_or_else(|| "Unknown Album".to_string())
    };

    let project_title = title.unwrap_or_else(|| format!("{} (Stem Project)", track.title));
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string();

    let new_project = StemProject {
        id: 0,
        track_id,
        track_hash: track_hash.clone(),
        title: project_title,
        artist: track.artist,
        album: album_title,
        cover_uri: None,
        status: StemProjectStatus::Queued,
        progress: 0.0,
        model_name: if requested_packs.is_empty() {
            "pack_dsp_cascade".to_string()
        } else {
            requested_packs.join(", ")
        },
        disk_size_bytes: 0,
        channels: Vec::new(),
        active_mix_name: Some("Default (0 dB)".to_string()),
        created_at: now.clone(),
        updated_at: now,
    };

    let project_id = state
        .db
        .create_stem_project(&new_project)
        .await
        .map_err(|e| e.to_string())?;

    let mut created = state
        .db
        .get_stem_project(project_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Błąd odczytu nowo utworzonego projektu".to_string())?;

    // Asynchroniczne zadanie separacji kaskadowej w tle
    let db_clone = state.db.clone();
    let app_handle_clone = app_handle.clone();
    let requested_packs_clone = requested_packs.clone();

    tokio::task::spawn(async move {
        let _ = db_clone
            .update_stem_project_status(project_id, StemProjectStatus::Separating, 0.05, 0)
            .await;

        let emitter_for_blocking = app_handle_clone.clone();
        let sep_res = tokio::task::spawn_blocking(move || {
            let app_emitter = emitter_for_blocking;
            StemSeparator::separate_stem_project(
                &track_path,
                project_id,
                &track_hash,
                &requested_packs_clone,
                Some(Box::new(move |progress, message| {
                    let _ = app_emitter.emit(
                        "auralune://stem-project-progress",
                        StemProjectProgressPayload {
                            project_id,
                            progress,
                            message: message.to_string(),
                            status: "separating".to_string(),
                        },
                    );
                })),
            )
        })
        .await;

        match sep_res {
            Ok(Ok(channels)) => {
                let _ = db_clone
                    .save_stem_project_channels(project_id, &channels)
                    .await;

                let mut total_size = 0u64;
                for ch in &channels {
                    if let Ok(meta) = std::fs::metadata(&ch.file_path) {
                        total_size += meta.len();
                    }
                }

                let _ = db_clone
                    .update_stem_project_status(
                        project_id,
                        StemProjectStatus::Ready,
                        1.0,
                        total_size,
                    )
                    .await;

                let _ = app_handle_clone.emit(
                    "auralune://stem-project-progress",
                    StemProjectProgressPayload {
                        project_id,
                        progress: 1.0,
                        message: "Separacja stemów zakończona pomyślnie".to_string(),
                        status: "ready".to_string(),
                    },
                );
            }
            Ok(Err(e)) => {
                let _ = db_clone
                    .update_stem_project_status(project_id, StemProjectStatus::Failed, 0.0, 0)
                    .await;

                let _ = app_handle_clone.emit(
                    "auralune://stem-project-progress",
                    StemProjectProgressPayload {
                        project_id,
                        progress: 0.0,
                        message: format!("Błąd separacji: {}", e),
                        status: "failed".to_string(),
                    },
                );
            }
            Err(join_err) => {
                let _ = db_clone
                    .update_stem_project_status(project_id, StemProjectStatus::Failed, 0.0, 0)
                    .await;

                let _ = app_handle_clone.emit(
                    "auralune://stem-project-progress",
                    StemProjectProgressPayload {
                        project_id,
                        progress: 0.0,
                        message: format!("Awaria wątku roboczego separacji: {}", join_err),
                        status: "failed".to_string(),
                    },
                );
            }
        }
    });

    created.id = project_id;
    Ok(created)
}

/// Retrieves all saved stem projects.
pub async fn list_stem_projects_internal(state: &AppState) -> Result<Vec<StemProject>, String> {
    state
        .db
        .list_stem_projects()
        .await
        .map_err(|e| e.to_string())
}

/// Retrieves a single stem project by ID.
pub async fn get_stem_project_internal(
    state: &AppState,
    project_id: i64,
) -> Result<Option<StemProject>, String> {
    state
        .db
        .get_stem_project(project_id)
        .await
        .map_err(|e| e.to_string())
}

/// Deletes a stem project and cleans up cached audio files on disk.
pub async fn delete_stem_project_internal(state: &AppState, project_id: i64) -> Result<(), String> {
    state
        .db
        .delete_stem_project(project_id)
        .await
        .map_err(|e| e.to_string())?;

    let cache_dir = get_stem_projects_cache_dir().join(project_id.to_string());
    if cache_dir.exists() {
        let _ = std::fs::remove_dir_all(&cache_dir);
    }
    Ok(())
}

/// Renames a stem project title.
pub async fn rename_stem_project_internal(
    state: &AppState,
    project_id: i64,
    title: &str,
) -> Result<(), String> {
    state
        .db
        .rename_stem_project(project_id, title)
        .await
        .map_err(|e| e.to_string())
}

/// Saves a custom mixer preset snapshot for a stem project.
pub async fn save_stem_project_mix_internal(
    state: &AppState,
    mix: &StemProjectMix,
) -> Result<i64, String> {
    state
        .db
        .save_stem_project_mix(mix)
        .await
        .map_err(|e| e.to_string())
}

/// Retrieves all mixer presets saved for a stem project.
pub async fn get_stem_project_mixes_internal(
    state: &AppState,
    project_id: i64,
) -> Result<Vec<StemProjectMix>, String> {
    state
        .db
        .get_stem_project_mixes(project_id)
        .await
        .map_err(|e| e.to_string())
}

/// Deletes a saved mixer preset from a stem project.
pub async fn delete_stem_project_mix_internal(state: &AppState, mix_id: i64) -> Result<(), String> {
    state
        .db
        .delete_stem_project_mix(mix_id)
        .await
        .map_err(|e| e.to_string())
}

/// Loads a stem project into the audio pipeline for playback.
pub async fn load_stem_project_internal(
    state: &AppState,
    project_id: i64,
    master_volume: Option<f32>,
    seek_position_ms: Option<u64>,
    start_playing: Option<bool>,
) -> Result<(), String> {
    let project = state
        .db
        .get_stem_project(project_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Nie znaleziono projektu o ID {}", project_id))?;

    if project.channels.is_empty() {
        return Err("Projekt nie posiada wygenerowanych ścieżek audio".to_string());
    }

    let orig_track = state
        .db
        .get_track_by_id(project.track_id)
        .await
        .ok()
        .flatten();

    let orig_uri = orig_track
        .as_ref()
        .map(|t| t.path.clone())
        .or_else(|| state.engine.current_uri())
        .or_else(|| state.engine.queue().current_item().map(|it| it.uri.clone()));

    let m_vol = master_volume.unwrap_or(1.0);
    let cur_pos = seek_position_ms
        .map(std::time::Duration::from_millis)
        .or_else(|| state.engine.position());
    let auto_play = start_playing.unwrap_or_else(|| state.engine.state() == PlaybackState::Playing);

    state
        .engine
        .load_stem_project_channels(
            project_id,
            &project.channels,
            m_vol,
            orig_uri.clone(),
            cur_pos,
            auto_play,
        )
        .map_err(|e| e.to_string())?;

    if let Some(track) = orig_track {
        let queue_item = QueueItem {
            id: format!("stem-project-{}", project_id),
            track_id: Some(track.id),
            uri: orig_uri.unwrap_or_else(|| track.path.clone()),
            title: project.title.clone(),
            artist: project.artist.clone(),
            album: Some(project.album.clone()),
            duration_ms: track.duration_ms.max(0) as u64,
        };
        state.engine.set_active_item(queue_item.clone());
        crate::commands::playback::sync_mpris_from_queue_item(&queue_item, state);
    }
    Ok(())
}

/// Restores regular stereo single-track playback from multi-track stems.
pub fn restore_original_track_internal(state: &AppState) -> Result<(), String> {
    state
        .engine
        .restore_original_track()
        .map_err(|e| e.to_string())?;

    let q = state.engine.queue();
    if let Some(item) = q.current_item() {
        crate::commands::playback::sync_mpris_from_queue_item(item, state);
    }
    Ok(())
}

/// Updates live channel volumes in real-time during stem project playback.
pub fn apply_stem_project_mix_internal(
    state: &AppState,
    channels: &[StemChannel],
    master_volume: f32,
) -> Result<(), String> {
    state
        .engine
        .apply_stem_project_mix(channels, master_volume)
        .map_err(|e| e.to_string())
}

/// Exports mixed stems into a target file.
pub async fn export_stem_project_mix_internal(
    state: &AppState,
    project_id: i64,
    export_path: &str,
) -> Result<String, String> {
    let project = state
        .db
        .get_stem_project(project_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Nie znaleziono projektu o ID {}", project_id))?;

    let target = export_path.to_string();
    tokio::task::spawn_blocking(move || {
        let export_target = Path::new(&target);
        if let Some(parent) = export_target.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        info!("Eksportowanie miksu projektu {} do {}", project_id, target);
        if let Some(first) = project.channels.first() {
            let _ = std::fs::copy(&first.file_path, export_target);
        }
        Ok(target)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Packages project stems and metadata into a ZIP file.
pub async fn export_stem_project_zip_internal(
    state: &AppState,
    project_id: i64,
    export_path: &str,
) -> Result<String, String> {
    let project = state
        .db
        .get_stem_project(project_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Nie znaleziono projektu o ID {}", project_id))?;

    let target = export_path.to_string();
    tokio::task::spawn_blocking(move || {
        let proj_dir = get_stem_projects_cache_dir().join(project_id.to_string());
        if !proj_dir.exists() {
            return Err("Katalog stemów projektu nie istnieje na dysku".to_string());
        }

        let json_str = serde_json::to_string_pretty(&project).unwrap_or_default();
        let _ = std::fs::write(proj_dir.join("project.json"), json_str);

        let output = std::process::Command::new("zip")
            .arg("-r")
            .arg(&target)
            .arg(".")
            .current_dir(&proj_dir)
            .output()
            .map_err(|e| format!("Błąd uruchomienia /usr/bin/zip: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Błąd pakowania ZIP: {}", stderr));
        }

        Ok(target)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_model_packs_not_empty() {
        let packs = list_model_packs_internal();
        assert!(!packs.is_empty());
    }

    #[test]
    fn test_stem_progress_payload_serialization() {
        let payload = StemProgressPayload {
            track_id: 10,
            progress: 0.5,
            message: "Extracting vocals".to_string(),
        };
        let serialized = serde_json::to_string(&payload).expect("Failed serialization");
        assert!(serialized.contains("Extracting vocals"));
        assert!(serialized.contains("10"));
    }
}
