//! Background update check: first ~30 s after start-up (so it does not slow the launch),
//! then every 6 h. Turned off with the `update_check_enabled = false` setting. The result is only a signal
//! (`auralune://update-available`): nothing is downloaded without the user's decision.

use crate::commands::updates::perform_check;
use crate::updater::{self, InstallKind, SETTING_ENABLED, UPDATE_AVAILABLE_EVENT};
use crate::AppState;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tracing::{debug, info, warn};

/// Starts the loop in the app's tokio runtime. Called once, after `app.manage(AppState)`.
pub fn spawn_update_checker(app: AppHandle) {
    let Some(state) = app.try_state::<AppState>().map(|s| s.inner().clone()) else {
        warn!("Update check: no AppState, the loop did not start");
        return;
    };
    // A debug build (dev server) does not query GitHub on its own.
    if updater::current_build_info().install_kind == InstallKind::DevServer {
        debug!("Background update check skipped (developer build)");
        return;
    }
    let rt = state.rt.clone();
    rt.spawn(async move {
        tokio::time::sleep(Duration::from_secs(updater::STARTUP_DELAY_SECS)).await;
        loop {
            let enabled = state
                .db
                .get_app_setting(SETTING_ENABLED)
                .await
                .ok()
                .flatten()
                .map(|v| v != "false")
                .unwrap_or(true);
            if enabled {
                match perform_check(&state.db, false).await {
                    Ok(update) if update.available => {
                        info!("Update available: {:?}", update.latest_version);
                        let _ = app.emit(UPDATE_AVAILABLE_EVENT, &update);
                    }
                    Ok(_) => debug!("The app is up to date"),
                    Err(e) => warn!("Update check failed: {}", e),
                }
            }
            tokio::time::sleep(Duration::from_secs(updater::CHECK_INTERVAL_SECS)).await;
        }
    });
}
