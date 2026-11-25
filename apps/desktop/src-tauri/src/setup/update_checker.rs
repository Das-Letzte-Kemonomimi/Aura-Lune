//! Sprawdzanie aktualizacji w tle: pierwsze ~30 s po starcie (żeby nie spowalniać uruchamiania),
//! potem co 6 h. Wyłączane ustawieniem `update_check_enabled = false`. Wynik jest tylko sygnałem
//! (`auralune://update-available`) — nic nie jest pobierane bez decyzji użytkownika.

use crate::commands::updates::perform_check;
use crate::updater::{self, InstallKind, SETTING_ENABLED, UPDATE_AVAILABLE_EVENT};
use crate::AppState;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tracing::{debug, info, warn};

/// Uruchamia pętlę w runtime tokio aplikacji. Wywoływane raz, po `app.manage(AppState)`.
pub fn spawn_update_checker(app: AppHandle) {
    let Some(state) = app.try_state::<AppState>().map(|s| s.inner().clone()) else {
        warn!("Sprawdzanie aktualizacji: brak AppState — pętla nie wystartowała");
        return;
    };
    // Build debug (serwer deweloperski) nie odpytuje GitHuba samoczynnie.
    if updater::current_build_info().install_kind == InstallKind::DevServer {
        debug!("Sprawdzanie aktualizacji w tle pominięte (build deweloperski)");
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
                        info!("Dostępna aktualizacja: {:?}", update.latest_version);
                        let _ = app.emit(UPDATE_AVAILABLE_EVENT, &update);
                    }
                    Ok(_) => debug!("Aplikacja jest aktualna"),
                    Err(e) => warn!("Sprawdzanie aktualizacji nie powiodło się: {}", e),
                }
            }
            tokio::time::sleep(Duration::from_secs(updater::CHECK_INTERVAL_SECS)).await;
        }
    });
}
