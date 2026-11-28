//! Background update check: first ~30 s after start-up (so it does not slow the launch), then whenever
//! 6 h have passed since the last successful check (also across restarts and suspend). A failed check is
//! retried after 15 min. Turned off with the `update_check_enabled = false` setting. The result is only a
//! signal (`auralune://update-available`): nothing is downloaded without the user's decision.

use crate::commands::updates::{perform_check, unix_now};
use crate::updater::{
    self, InstallKind, SETTING_ENABLED, SETTING_LAST_CHECKED, UPDATE_AVAILABLE_EVENT,
};
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
        let mut retry_not_before: Option<u64> = None;
        loop {
            let now = unix_now();
            let last_checked = state
                .db
                .get_app_setting(SETTING_LAST_CHECKED)
                .await
                .ok()
                .flatten()
                .and_then(|v| v.parse::<u64>().ok());
            if updater::background_check_due(now, last_checked, retry_not_before)
                && is_enabled(&state).await
            {
                // The 6 h throttle is decided here, so `perform_check` always queries GitHub.
                match perform_check(&state.db, true).await {
                    Ok(update) => {
                        retry_not_before = None;
                        if update.available {
                            info!("Update available: {:?}", update.latest_version);
                            let _ = app.emit(UPDATE_AVAILABLE_EVENT, &update);
                        } else {
                            debug!("The app is up to date");
                        }
                    }
                    Err(e) => {
                        warn!("Update check failed, retrying later: {}", e);
                        retry_not_before = Some(now + updater::RETRY_AFTER_FAILURE_SECS);
                    }
                }
            }
            tokio::time::sleep(Duration::from_secs(updater::POLL_INTERVAL_SECS)).await;
        }
    });
}

/// The user switch for background checks (on unless explicitly `false`).
async fn is_enabled(state: &AppState) -> bool {
    state
        .db
        .get_app_setting(SETTING_ENABLED)
        .await
        .ok()
        .flatten()
        .map(|v| v != "false")
        .unwrap_or(true)
}
