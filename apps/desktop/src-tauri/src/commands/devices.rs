use crate::AppState;
use audio_engine::DeviceManager;
use desktop_integration::{DiscordRpcStatus, DEFAULT_DISCORD_CLIENT_ID};
use domain::device::{AudioCard, BluetoothCodec};
use domain::PlaybackState;
use tracing::info;

/// Lists all audio cards and endpoints detected on the host system via PipeWire / ALSA.
#[tauri::command]
pub fn list_devices() -> Result<Vec<AudioCard>, String> {
    DeviceManager::list_cards().map_err(|e| e.to_string())
}

/// Sets audio card profile (e.g. Pro Audio, Stereo Output).
#[tauri::command]
pub fn set_device_profile(card_name: String, profile_name: String) -> Result<(), String> {
    DeviceManager::set_card_profile(&card_name, &profile_name).map_err(|e| e.to_string())
}

/// Sets Bluetooth audio codec (LDAC, aptX HD, AAC, SBC).
#[tauri::command]
pub fn set_bluetooth_codec(card_name: String, codec: BluetoothCodec) -> Result<(), String> {
    DeviceManager::set_bluetooth_codec(&card_name, &codec).map_err(|e| e.to_string())
}

/// Enables Pro Audio mode on the given audio card.
#[tauri::command]
pub fn enable_pro_audio(card_name: String) -> Result<(), String> {
    DeviceManager::enable_pro_audio(&card_name).map_err(|e| e.to_string())
}

/// Disables Pro Audio mode and restores previous profile.
#[tauri::command]
pub fn disable_pro_audio(card_name: String) -> Result<String, String> {
    DeviceManager::disable_pro_audio(&card_name).map_err(|e| e.to_string())
}

/// Alias for set_device_profile.
#[tauri::command]
pub fn set_card_profile(card_name: String, profile: String) -> Result<(), String> {
    DeviceManager::set_card_profile(&card_name, &profile).map_err(|e| e.to_string())
}

pub fn list_devices_internal() -> Result<Vec<AudioCard>, String> {
    list_devices()
}

pub fn set_device_profile_internal(card_name: &str, profile_name: &str) -> Result<(), String> {
    DeviceManager::set_card_profile(card_name, profile_name).map_err(|e| e.to_string())
}

pub fn set_bluetooth_codec_internal(card_name: &str, codec: &BluetoothCodec) -> Result<(), String> {
    DeviceManager::set_bluetooth_codec(card_name, codec).map_err(|e| e.to_string())
}

pub fn enable_pro_audio_internal(card_name: &str) -> Result<(), String> {
    DeviceManager::enable_pro_audio(card_name).map_err(|e| e.to_string())
}

pub fn disable_pro_audio_internal(card_name: &str) -> Result<String, String> {
    DeviceManager::disable_pro_audio(card_name).map_err(|e| e.to_string())
}

/// Retrieves current Discord Rich Presence status.
pub fn get_discord_rpc_status_internal(state: &AppState) -> Result<DiscordRpcStatus, String> {
    if let Some(discord) = &state.discord_rpc {
        Ok(discord.get_status())
    } else {
        Ok(DiscordRpcStatus {
            enabled: false,
            connected: false,
            client_id: DEFAULT_DISCORD_CLIENT_ID.to_string(),
            current_activity: None,
        })
    }
}

/// Toggles Discord RPC status and persists the preference.
pub async fn set_discord_rpc_enabled_internal(
    state: &AppState,
    enabled: bool,
) -> Result<(), String> {
    info!("Tauri command: set_discord_rpc_enabled({})", enabled);
    if let Some(discord) = &state.discord_rpc {
        discord.set_enabled(enabled);
    }
    state
        .db
        .set_app_setting(
            "discord_rpc_enabled",
            if enabled { "true" } else { "false" },
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Sets custom Discord application Client ID.
pub async fn set_discord_rpc_client_id_internal(
    state: &AppState,
    client_id: &str,
) -> Result<(), String> {
    info!("Tauri command: set_discord_rpc_client_id('{}')", client_id);
    let trimmed = client_id.trim();
    if let Some(discord) = &state.discord_rpc {
        discord.set_client_id(trimmed.to_string());
    }
    state
        .db
        .set_app_setting("discord_rpc_client_id", trimmed)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Notifies desktop integrations (Discord RPC & MPRIS) when track looping occurs.
pub fn notify_track_looped_internal(
    state: &AppState,
    position_ms: Option<u64>,
) -> Result<(), String> {
    let pos = position_ms.unwrap_or(0);
    let dur = state
        .engine
        .duration()
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    if let Some(discord) = &state.discord_rpc {
        discord.update_playback_status(PlaybackState::Playing, pos, dur);
    }

    if let Some(mpris) = &state.mpris {
        let m = mpris.clone();
        state.rt.spawn(async move {
            m.emit_seeked(pos).await;
        });
    }

    Ok(())
}
