//! Clean-up when the app quits (`RunEvent::Exit`).

use crate::setup::app_init::VOLUME_SETTING_KEY;
use crate::AppState;
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

/// Stops playback, saves the final queue state synchronously (a delayed write
/// might not make it in time), removes the Waybar status file and stops the IPC control server.
pub fn on_exit(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    info!("Quitting Auralune: saving state and releasing resources");
    let queue = state.engine.queue();
    if let Err(e) = state.rt.block_on(state.db.save_queue_state(&queue)) {
        warn!("Failed to save the queue on quit: {}", e);
    }
    let volume = state.engine.volume().clamp(0.0, 1.0);
    if let Err(e) = state.rt.block_on(
        state
            .db
            .set_app_setting(VOLUME_SETTING_KEY, &volume.to_string()),
    ) {
        warn!("Failed to save the volume on quit: {}", e);
    }
    crate::setup::playback_ticker::stop_playback_ticker();
    let _ = state.engine.stop();
    if let Some(ipc) = &state.control_ipc {
        ipc.stop();
    }
    desktop_integration::cleanup_waybar_status();
}
