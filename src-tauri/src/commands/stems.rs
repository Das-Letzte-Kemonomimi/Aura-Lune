use super::error::CommandError;
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
use tauri::{Emitter, State};

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
pub fn delete_ai_model_internal(model_id: &str) -> Result<(), CommandError> {
    remove_model_file(model_id)
        .map(|_| ())
        .map_err(CommandError::from)
}

/// Downloads an AI stem separation model with SHA256 integrity verification.
pub async fn download_ai_model_internal(
    model_id: &str,
    app_handle: &tauri::AppHandle,
) -> Result<(), CommandError> {
    let catalog = audio_engine::get_default_model_catalog();
    let model = catalog
        .into_iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| CommandError::not_found(format!("Unknown AI model: {}", model_id)))?;

    let url = model
        .download_url
        .ok_or_else(|| CommandError::validation("Model has no download URL defined"))?;

    let dest_path = PathBuf::from(&model.file_path);
    if let Some(parent) = dest_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let app_handle_clone = app_handle.clone();
    let m_id_clone = model_id.to_string();
    let cancel_flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let started = std::time::Instant::now();
    let last_emit = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    const PROGRESS_EMIT_INTERVAL_MS: u64 = 200;

    let provider = downloads::HttpDownloadProvider::new();
    let _ = provider
        .download(
            &url,
            &dest_path,
            Some(&model.sha256),
            cancel_flag,
            Some(Box::new(move |downloaded, total| {
                let elapsed = started.elapsed().as_millis() as u64;
                let finished = total.is_some_and(|t| downloaded >= t);
                let previous = last_emit.load(std::sync::atomic::Ordering::Relaxed);
                if !finished && elapsed.saturating_sub(previous) < PROGRESS_EMIT_INTERVAL_MS {
                    return;
                }
                last_emit.store(elapsed, std::sync::atomic::Ordering::Relaxed);
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
        .map_err(|e| {
            CommandError::from(e).context(format!("Failed to download model {}", model_id))
        })?;

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
) -> Result<StemSeparationData, CommandError> {
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
    .map_err(|e| CommandError::from(e).context("Separation thread error"))?
    .map_err(|e| CommandError::from(e).context("Stem separation error"))?;

    // Store in SQLite
    let _ = state.db.save_stem_tracks(&separation).await;

    Ok(separation)
}

/// Retrieves cached stem separation tracks for a track ID.
pub async fn get_track_stems_internal(
    state: &AppState,
    track_id: i64,
) -> Result<Option<StemSeparationData>, CommandError> {
    state
        .db
        .get_stem_tracks(track_id)
        .await
        .map_err(CommandError::from)
}

/// Loads multi-track stem audio into the real-time audio pipeline.
pub async fn load_track_stems_internal(
    state: &AppState,
    track_id: i64,
    seek_position_ms: Option<u64>,
    start_playing: Option<bool>,
) -> Result<StemMixerState, CommandError> {
    let stems = state.db.get_stem_tracks(track_id).await?.ok_or_else(|| {
        "No separated stems for this track. Start the separation first.".to_string()
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

    state.engine.load_stems(
        &stems,
        mixer_state.clone(),
        orig_uri.clone(),
        cur_pos,
        auto_play,
    )?;

    if let Some(track) = orig_track {
        let album_title = state.db.queue_item_for_track(&track).await.album;
        let queue_item = QueueItem {
            id: format!("stems-track-{}", track_id),
            track_id: Some(track.id),
            uri: orig_uri.unwrap_or_else(|| track.path.clone()),
            title: track.title.clone(),
            artist: track.artist.clone(),
            album: album_title,
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
) -> Result<(), CommandError> {
    state
        .engine
        .set_stem_mixer_state(state_payload)
        .map_err(CommandError::from)
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
) -> Result<StemProject, CommandError> {
    let track =
        state.db.get_track_by_id(track_id).await?.ok_or_else(|| {
            CommandError::not_found(format!("Track with ID {} not found", track_id))
        })?;

    let track_path = track.path.clone();
    // SHA-256 of the whole audio file (hundreds of MB for hi-res), off the Tokio threads.
    let hash_path = track_path.clone();
    let track_hash = tokio::task::spawn_blocking(move || {
        audio_engine::calculate_file_sha256(Path::new(&hash_path))
    })
    .await
    .map_err(|e| CommandError::internal(format!("SHA-256 computation interrupted: {e}")))?
    .map_err(|e| CommandError::from(e).context("SHA-256 computation error"))?;

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

    let project_id = state.db.create_stem_project(&new_project).await?;

    let mut created = state
        .db
        .get_stem_project(project_id)
        .await?
        .ok_or_else(|| CommandError::internal("Failed to read the newly created project"))?;

    // Asynchronous cascaded separation task in the background
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
                        message: "Stem separation finished".to_string(),
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
                        message: format!("Separation error: {}", e),
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
                        message: format!("Separation worker thread crashed: {}", join_err),
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
pub async fn list_stem_projects_internal(
    state: &AppState,
) -> Result<Vec<StemProject>, CommandError> {
    state
        .db
        .list_stem_projects()
        .await
        .map_err(CommandError::from)
}

/// Retrieves a single stem project by ID.
pub async fn get_stem_project_internal(
    state: &AppState,
    project_id: i64,
) -> Result<Option<StemProject>, CommandError> {
    state
        .db
        .get_stem_project(project_id)
        .await
        .map_err(CommandError::from)
}

/// Deletes a stem project and cleans up cached audio files on disk.
pub async fn delete_stem_project_internal(
    state: &AppState,
    project_id: i64,
) -> Result<(), CommandError> {
    state.db.delete_stem_project(project_id).await?;

    let cache_dir = get_stem_projects_cache_dir().join(project_id.to_string());
    if cache_dir.exists() {
        let _ = tokio::task::spawn_blocking(move || std::fs::remove_dir_all(&cache_dir)).await;
    }
    Ok(())
}

/// Renames a stem project title.
pub async fn rename_stem_project_internal(
    state: &AppState,
    project_id: i64,
    title: &str,
) -> Result<(), CommandError> {
    state
        .db
        .rename_stem_project(project_id, title)
        .await
        .map_err(CommandError::from)
}

/// Saves a custom mixer preset snapshot for a stem project.
pub async fn save_stem_project_mix_internal(
    state: &AppState,
    mix: &StemProjectMix,
) -> Result<i64, CommandError> {
    state
        .db
        .save_stem_project_mix(mix)
        .await
        .map_err(CommandError::from)
}

/// Retrieves all mixer presets saved for a stem project.
pub async fn get_stem_project_mixes_internal(
    state: &AppState,
    project_id: i64,
) -> Result<Vec<StemProjectMix>, CommandError> {
    state
        .db
        .get_stem_project_mixes(project_id)
        .await
        .map_err(CommandError::from)
}

/// Deletes a saved mixer preset from a stem project.
pub async fn delete_stem_project_mix_internal(
    state: &AppState,
    mix_id: i64,
) -> Result<(), CommandError> {
    state
        .db
        .delete_stem_project_mix(mix_id)
        .await
        .map_err(CommandError::from)
}

/// Loads a stem project into the audio pipeline for playback.
pub async fn load_stem_project_internal(
    state: &AppState,
    project_id: i64,
    master_volume: Option<f32>,
    seek_position_ms: Option<u64>,
    start_playing: Option<bool>,
) -> Result<(), CommandError> {
    let project = state
        .db
        .get_stem_project(project_id)
        .await?
        .ok_or_else(|| {
            CommandError::not_found(format!("Project with ID {} not found", project_id))
        })?;

    if project.channels.is_empty() {
        return Err(CommandError::validation(
            "The project has no generated audio tracks",
        ));
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

    state.engine.load_stem_project_channels(
        project_id,
        &project.channels,
        m_vol,
        orig_uri.clone(),
        cur_pos,
        auto_play,
    )?;

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
pub fn restore_original_track_internal(state: &AppState) -> Result<(), CommandError> {
    state.engine.restore_original_track()?;

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
) -> Result<(), CommandError> {
    state
        .engine
        .apply_stem_project_mix(channels, master_volume)
        .map_err(CommandError::from)
}

/// Packages project stems and metadata into a ZIP file.
pub async fn export_stem_project_zip_internal(
    state: &AppState,
    project_id: i64,
    export_path: &str,
) -> Result<String, CommandError> {
    let project = state
        .db
        .get_stem_project(project_id)
        .await?
        .ok_or_else(|| {
            CommandError::not_found(format!("Project with ID {} not found", project_id))
        })?;

    let target = export_path.to_string();
    tokio::task::spawn_blocking(move || {
        let proj_dir = get_stem_projects_cache_dir().join(project_id.to_string());
        if !proj_dir.exists() {
            return Err(CommandError::not_found(
                "The project's stem directory does not exist on disk",
            ));
        }

        let json_str = serde_json::to_string_pretty(&project)?;
        std::fs::write(proj_dir.join("project.json"), json_str)
            .map_err(|e| CommandError::from(e).context("Failed to write project.json"))?;

        // `zip -r` appends to an existing archive, so we pack into a fresh temp file
        // and replace the target only on success (no old entries or half-written files).
        let partial = format!("{target}.partial.zip");
        let _ = std::fs::remove_file(&partial);
        let output = std::process::Command::new("zip")
            .arg("-q")
            .arg("-r")
            .arg(&partial)
            .arg(".")
            .current_dir(&proj_dir)
            .output()
            .map_err(|e| CommandError::from(e).context("Failed to run /usr/bin/zip"))?;

        if !output.status.success() {
            let _ = std::fs::remove_file(&partial);
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(CommandError::from(format!("ZIP packing error: {}", stderr)));
        }
        std::fs::rename(&partial, &target).map_err(|e| {
            let _ = std::fs::remove_file(&partial);
            CommandError::from(e).context("Failed to write the ZIP archive")
        })?;

        Ok(target)
    })
    .await?
}

// =========================================================================
// TAURI COMMAND WRAPPERS FOR STEMS
// =========================================================================

#[tauri::command]
pub fn list_ai_models() -> Result<Vec<AiModelInfo>, CommandError> {
    Ok(list_ai_models_internal())
}

#[tauri::command]
pub async fn delete_ai_model(model_id: String) -> Result<(), CommandError> {
    tokio::task::spawn_blocking(move || delete_ai_model_internal(&model_id)).await?
}

#[tauri::command]
pub async fn download_ai_model(
    model_id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), CommandError> {
    download_ai_model_internal(&model_id, &app_handle).await
}

#[tauri::command]
pub async fn start_stem_separation(
    path: String,
    track_id: i64,
    model_id: Option<String>,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<StemSeparationData, CommandError> {
    start_stem_separation_internal(&state, path, track_id, model_id, &app_handle).await
}

#[tauri::command]
pub async fn get_track_stems(
    track_id: i64,
    state: State<'_, AppState>,
) -> Result<Option<StemSeparationData>, CommandError> {
    get_track_stems_internal(&state, track_id).await
}

#[tauri::command]
pub async fn load_track_stems(
    track_id: i64,
    seek_position_ms: Option<u64>,
    start_playing: Option<bool>,
    state: State<'_, AppState>,
) -> Result<StemMixerState, CommandError> {
    load_track_stems_internal(&state, track_id, seek_position_ms, start_playing).await
}

#[tauri::command]
pub async fn set_stem_mixer_state(
    state_payload: StemMixerState,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    set_stem_mixer_state_internal(&state, state_payload)
}

#[tauri::command]
pub async fn get_stem_mixer_state(
    state: State<'_, AppState>,
) -> Result<StemMixerState, CommandError> {
    Ok(get_stem_mixer_state_internal(&state))
}

#[tauri::command]
pub async fn list_model_packs() -> Result<Vec<ModelPackInfo>, CommandError> {
    Ok(list_model_packs_internal())
}

#[tauri::command]
pub async fn create_stem_project(
    track_id: i64,
    title: Option<String>,
    requested_packs: Vec<String>,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<StemProject, CommandError> {
    create_stem_project_internal(&state, track_id, title, requested_packs, &app_handle).await
}

#[tauri::command]
pub async fn list_stem_projects(
    state: State<'_, AppState>,
) -> Result<Vec<StemProject>, CommandError> {
    list_stem_projects_internal(&state).await
}

#[tauri::command]
pub async fn get_stem_project(
    project_id: i64,
    state: State<'_, AppState>,
) -> Result<Option<StemProject>, CommandError> {
    get_stem_project_internal(&state, project_id).await
}

#[tauri::command]
pub async fn delete_stem_project(
    project_id: i64,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    delete_stem_project_internal(&state, project_id).await
}

#[tauri::command]
pub async fn rename_stem_project(
    project_id: i64,
    title: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    rename_stem_project_internal(&state, project_id, &title).await
}

#[tauri::command]
pub async fn save_stem_project_mix(
    mix: StemProjectMix,
    state: State<'_, AppState>,
) -> Result<i64, CommandError> {
    save_stem_project_mix_internal(&state, &mix).await
}

#[tauri::command]
pub async fn get_stem_project_mixes(
    project_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<StemProjectMix>, CommandError> {
    get_stem_project_mixes_internal(&state, project_id).await
}

#[tauri::command]
pub async fn load_stem_project(
    project_id: i64,
    master_volume: Option<f32>,
    seek_position_ms: Option<u64>,
    start_playing: Option<bool>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    load_stem_project_internal(
        &state,
        project_id,
        master_volume,
        seek_position_ms,
        start_playing,
    )
    .await
}

#[tauri::command]
pub async fn restore_original_track(state: State<'_, AppState>) -> Result<(), CommandError> {
    restore_original_track_internal(&state)
}

#[tauri::command]
pub async fn apply_stem_project_mix(
    channels: Vec<StemChannel>,
    master_volume: f32,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    apply_stem_project_mix_internal(&state, &channels, master_volume)
}

#[tauri::command]
pub async fn export_stem_project_zip(
    project_id: i64,
    export_path: String,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    let resolved = super::paths::ensure_writable(std::path::Path::new(&export_path))?;
    export_stem_project_zip_internal(&state, project_id, &resolved.to_string_lossy()).await
}
