use super::error::CommandError;
use crate::AppState;
use audio_engine::DeviceManager;
use desktop_integration::{DiscordRpcStatus, DEFAULT_DISCORD_CLIENT_ID};
use domain::device::{AudioCard, BluetoothCodec};
use tracing::info;

/// Lists all audio cards and endpoints detected on the host system via PipeWire / ALSA.
#[tauri::command]
pub async fn list_devices() -> Result<Vec<AudioCard>, CommandError> {
    tokio::task::spawn_blocking(move || -> Result<Vec<AudioCard>, CommandError> {
        DeviceManager::list_cards().map_err(CommandError::from)
    })
    .await?
}

/// Sets Bluetooth audio codec (LDAC, aptX HD, AAC, SBC).
#[tauri::command]
pub async fn set_bluetooth_codec(
    card_name: String,
    codec: BluetoothCodec,
) -> Result<(), CommandError> {
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> {
        DeviceManager::set_bluetooth_codec(&card_name, &codec).map_err(CommandError::from)
    })
    .await?
}

/// Enables Pro Audio mode on the given audio card.
#[tauri::command]
pub async fn enable_pro_audio(card_name: String) -> Result<(), CommandError> {
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> {
        DeviceManager::enable_pro_audio(&card_name).map_err(CommandError::from)
    })
    .await?
}

/// Disables Pro Audio mode and restores previous profile.
#[tauri::command]
pub async fn disable_pro_audio(card_name: String) -> Result<String, CommandError> {
    tokio::task::spawn_blocking(move || -> Result<String, CommandError> {
        DeviceManager::disable_pro_audio(&card_name).map_err(CommandError::from)
    })
    .await?
}

/// Alias for set_device_profile.
#[tauri::command]
pub async fn set_card_profile(card_name: String, profile: String) -> Result<(), CommandError> {
    tokio::task::spawn_blocking(move || -> Result<(), CommandError> {
        DeviceManager::set_card_profile(&card_name, &profile).map_err(CommandError::from)
    })
    .await?
}

/// Retrieves current Discord Rich Presence status.
pub fn get_discord_rpc_status_internal(state: &AppState) -> Result<DiscordRpcStatus, CommandError> {
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
) -> Result<(), CommandError> {
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
        .await?;
    Ok(())
}

/// Sets custom Discord application Client ID.
pub async fn set_discord_rpc_client_id_internal(
    state: &AppState,
    client_id: &str,
) -> Result<(), CommandError> {
    info!("Tauri command: set_discord_rpc_client_id('{}')", client_id);
    let trimmed = client_id.trim();
    if let Some(discord) = &state.discord_rpc {
        discord.set_client_id(trimmed.to_string());
    }
    state
        .db
        .set_app_setting("discord_rpc_client_id", trimmed)
        .await?;
    Ok(())
}
