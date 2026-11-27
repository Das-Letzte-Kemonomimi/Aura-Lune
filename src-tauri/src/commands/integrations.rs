//! External integrations: ListenBrainz, Last.fm, Discord RPC and the profile backup.

use super::error::CommandError;
use crate::commands::playlists::PlaylistExportDto;
use crate::AppState;
use domain::Theme;
use metadata::LastFmSession;
use serde::{Deserialize, Serialize};
use std::fs;
use storage::DspPresetRecord;
use tauri::{Manager, State};
use tracing::{info, warn};

pub use crate::commands::metadata::{LastFmAuthUrlResult, LastFmScrobbleRequest};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileBackupDto {
    pub version: String,
    pub exported_at_timestamp: u64,
    pub dsp_presets: Vec<DspPresetRecord>,
    pub themes: Vec<Theme>,
    pub playlists: Vec<PlaylistExportDto>,
}

#[tauri::command]
pub async fn export_profile_backup(
    destination_path: Option<String>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    info!(
        "Tauri command: export_profile_backup(dest: {:?})",
        destination_path
    );
    let destination = destination_path
        .as_deref()
        .map(|dest| super::paths::ensure_writable(std::path::Path::new(dest)))
        .transpose()?;
    let presets = state.db.list_dsp_presets().await.unwrap_or_default();
    let mut themes = state.db.list_themes().await.unwrap_or_default();
    let playlists = state.db.list_playlists().await.unwrap_or_default();

    let data_dir = app.path().app_data_dir()?;
    themes = tokio::task::spawn_blocking(move || {
        for theme in &mut themes {
            if theme
                .background_ref
                .as_deref()
                .is_some_and(|r| r.starts_with("auralune-media://"))
            {
                theme.background_ref = crate::commands::themes::inline_background_ref_for_export(
                    &data_dir,
                    theme.background_ref.as_deref(),
                );
            }
        }
        themes
    })
    .await?;

    let mut playlist_exports = Vec::new();
    for pl in playlists {
        let tracks = state
            .db
            .get_playlist_tracks(pl.id)
            .await
            .unwrap_or_default();
        playlist_exports.push(PlaylistExportDto {
            name: pl.name,
            track_paths: tracks.into_iter().map(|t| t.path).collect(),
        });
    }

    let now_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let backup = ProfileBackupDto {
        version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at_timestamp: now_ts,
        dsp_presets: presets,
        themes,
        playlists: playlist_exports,
    };

    let json = serde_json::to_string_pretty(&backup)
        .map_err(|e| CommandError::from(e).context("Failed to serialise the profile backup"))?;

    if let Some(dest) = destination {
        fs::write(&dest, &json)
            .map_err(|e| CommandError::from(e).context("Failed to write the backup file"))?;
        Ok(format!("Saved the profile backup to: {}", dest.display()))
    } else {
        Ok(json)
    }
}

#[tauri::command]
pub async fn import_profile_backup(
    file_path_or_json: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    info!("Tauri command: import_profile_backup");
    let json_content = if file_path_or_json.trim().starts_with('{') {
        file_path_or_json
    } else {
        let resolved =
            super::paths::ensure_readable(std::path::Path::new(&file_path_or_json), &["json"])?;
        fs::read_to_string(&resolved)
            .map_err(|e| CommandError::from(e).context("Failed to read the backup file"))?
    };

    let backup: ProfileBackupDto = serde_json::from_str(&json_content)
        .map_err(|e| CommandError::from(e).context("Invalid profile backup JSON format"))?;

    let mut restored_presets = 0;
    let mut restored_themes = 0;
    let mut restored_playlists = 0;

    for preset in backup.dsp_presets {
        if state
            .db
            .save_dsp_preset(
                &preset.name,
                &preset.engine,
                preset.pitch_semitones,
                preset.tempo_ratio,
                preset.rate_ratio,
            )
            .await
            .is_ok()
        {
            restored_presets += 1;
        }
    }

    let data_dir = app.path().app_data_dir()?;
    for mut theme in backup.themes {
        if let Err(e) = theme.validate() {
            warn!(
                "Skipped invalid theme '{}' from the profile backup: {}",
                theme.id, e
            );
            continue;
        }
        if theme
            .background_ref
            .as_deref()
            .is_some_and(|r| r.trim().starts_with("data:"))
        {
            let dir = data_dir.clone();
            let bg = theme.background_ref.take();
            match tokio::task::spawn_blocking(move || {
                crate::commands::themes::normalize_background_ref_for_storage(&dir, bg)
            })
            .await?
            {
                Ok(url) => theme.background_ref = url,
                Err(e) => {
                    warn!(
                        "Failed to store wallpaper for imported theme '{}': {}",
                        theme.id, e
                    );
                }
            }
        }
        if state.db.save_theme(&theme).await.is_ok() {
            restored_themes += 1;
        }
    }

    for pl in backup.playlists {
        if let Ok(pl_id) = state.db.create_playlist(&pl.name).await {
            restored_playlists += 1;
            for path in pl.track_paths {
                if let Ok(Some(track)) = state.db.find_track_by_path_or_uri(&path).await {
                    let _ = state.db.add_track_to_playlist(pl_id, track.id).await;
                }
            }
        }
    }

    Ok(format!(
        "Restored the profile (backup version: {}): {} DSP presets, {} themes, {} playlists.",
        backup.version, restored_presets, restored_themes, restored_playlists
    ))
}

#[tauri::command]
pub async fn validate_listenbrainz_token(
    token: String,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    crate::commands::metadata::validate_listenbrainz_token_internal(&state, &token).await
}

#[tauri::command]
pub async fn submit_listenbrainz_playing_now(
    token: String,
    artist: String,
    title: String,
    album: Option<String>,
    duration_ms: Option<u64>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    crate::commands::metadata::submit_listenbrainz_playing_now_internal(
        &state,
        &token,
        &artist,
        &title,
        album.as_deref(),
        duration_ms,
    )
    .await
}

#[tauri::command]
pub async fn submit_listenbrainz_listen(
    token: String,
    artist: String,
    title: String,
    album: Option<String>,
    duration_ms: Option<u64>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    crate::commands::metadata::submit_listenbrainz_listen_internal(
        &state,
        &token,
        &artist,
        &title,
        album.as_deref(),
        duration_ms,
    )
    .await
}

#[tauri::command]
pub async fn lastfm_get_auth_url(
    api_key: Option<String>,
    state: State<'_, AppState>,
) -> Result<LastFmAuthUrlResult, CommandError> {
    crate::commands::metadata::lastfm_get_auth_url_internal(&state, api_key).await
}

#[tauri::command]
pub async fn lastfm_fetch_session(
    token: String,
    api_key: Option<String>,
    api_secret: Option<String>,
    state: State<'_, AppState>,
) -> Result<LastFmSession, CommandError> {
    crate::commands::metadata::lastfm_fetch_session_internal(
        &state,
        &token,
        api_key.as_deref(),
        api_secret.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn lastfm_validate_session(
    session_key: String,
    api_key: Option<String>,
    api_secret: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    crate::commands::metadata::lastfm_validate_session_internal(
        &state,
        &session_key,
        api_key.as_deref(),
        api_secret.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn lastfm_update_now_playing(
    request: LastFmScrobbleRequest,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    crate::commands::metadata::lastfm_update_now_playing_internal(&state, &request).await
}

#[tauri::command]
pub async fn lastfm_scrobble(
    request: LastFmScrobbleRequest,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    crate::commands::metadata::lastfm_scrobble_internal(&state, &request).await
}

#[tauri::command]
pub fn get_discord_rpc_status(
    state: State<'_, AppState>,
) -> Result<desktop_integration::DiscordRpcStatus, CommandError> {
    crate::commands::devices::get_discord_rpc_status_internal(&state)
}

#[tauri::command]
pub async fn set_discord_rpc_enabled(
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    crate::commands::devices::set_discord_rpc_enabled_internal(&state, enabled).await
}

#[tauri::command]
pub async fn set_discord_rpc_client_id(
    client_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    crate::commands::devices::set_discord_rpc_client_id_internal(&state, &client_id).await
}
