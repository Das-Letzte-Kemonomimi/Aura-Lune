//! Porządkowanie przy zamykaniu aplikacji (`RunEvent::Exit`).

use crate::setup::app_init::VOLUME_SETTING_KEY;
use crate::AppState;
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

/// Zatrzymuje odtwarzanie, synchronicznie zapisuje końcowy stan kolejki (zapis z opóźnieniem
/// mógłby nie zdążyć), usuwa plik statusu Waybar i zatrzymuje serwer sterowania IPC.
pub fn on_exit(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    info!("Zamykanie Auralune — zapis stanu i zwalnianie zasobów");
    let queue = state.engine.queue();
    if let Err(e) = state.rt.block_on(state.db.save_queue_state(&queue)) {
        warn!("Nie udało się zapisać kolejki przy zamykaniu: {}", e);
    }
    let volume = state.engine.volume().clamp(0.0, 1.0);
    if let Err(e) = state.rt.block_on(
        state
            .db
            .set_app_setting(VOLUME_SETTING_KEY, &volume.to_string()),
    ) {
        warn!("Nie udało się zapisać głośności przy zamykaniu: {}", e);
    }
    let _ = state.engine.stop();
    if let Some(ipc) = &state.control_ipc {
        ipc.stop();
    }
    desktop_integration::cleanup_waybar_status();
}
