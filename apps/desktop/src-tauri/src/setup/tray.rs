//! Konfiguracja zasobnika systemowego (System Tray) oraz obsługa zdarzeń okna głównego.

use crate::AppState;
use tauri::Manager;

/// Konfiguruje ikonę i menu zasobnika systemowego oraz minimalizację do zasobnika przy zamykaniu okna.
pub fn setup_tray_and_window_events(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Inicjalizacja zasobnika systemowego (System Tray) na pulpicie Linuksa
    let show_i = tauri::menu::MenuItem::with_id(
        app,
        "tray_show",
        "🌸 Pokaż Auralune / Show Window",
        true,
        None::<&str>,
    )?;
    let play_i = tauri::menu::MenuItem::with_id(
        app,
        "tray_play_pause",
        "⏯️ Odtwórz / Wstrzymaj (Play/Pause)",
        true,
        None::<&str>,
    )?;
    let next_i = tauri::menu::MenuItem::with_id(
        app,
        "tray_next",
        "⏭️ Następny utwór / Next",
        true,
        None::<&str>,
    )?;
    let prev_i = tauri::menu::MenuItem::with_id(
        app,
        "tray_prev",
        "⏮️ Poprzedni utwór / Previous",
        true,
        None::<&str>,
    )?;
    let quit_i =
        tauri::menu::MenuItem::with_id(app, "tray_quit", "🚪 Zakończ / Quit", true, None::<&str>)?;
    let tray_menu =
        tauri::menu::Menu::with_items(app, &[&show_i, &play_i, &next_i, &prev_i, &quit_i])?;

    if let Some(default_icon) = app.default_window_icon() {
        let _ = tauri::tray::TrayIconBuilder::new()
            .icon(default_icon.clone())
            .tooltip("Auralune — Kitsune Music Player")
            .menu(&tray_menu)
            .show_menu_on_left_click(false)
            .on_menu_event(|app, event| match event.id.as_ref() {
                "tray_show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                "tray_play_pause" => {
                    // Te same ścieżki co komendy UI: MPRIS, Discord i zapis kolejki pozostają spójne,
                    // a interfejs dostaje nowy status ze zdarzenia tickera odtwarzania.
                    let state = app.state::<AppState>();
                    let result = if state.engine.state() == domain::PlaybackState::Playing {
                        crate::commands::playback::pause_internal(&state)
                    } else {
                        crate::commands::playback::play_internal(&state)
                    };
                    if let Err(e) = result {
                        tracing::warn!("Zasobnik: play/pause nie powiodło się: {}", e);
                    }
                }
                "tray_next" => {
                    let state = app.state::<AppState>();
                    if let Err(e) = crate::commands::queue::play_next_internal(&state) {
                        tracing::warn!("Zasobnik: następny utwór nie powiódł się: {}", e);
                    }
                }
                "tray_prev" => {
                    let state = app.state::<AppState>();
                    if let Err(e) = crate::commands::queue::play_previous_internal(&state) {
                        tracing::warn!("Zasobnik: poprzedni utwór nie powiódł się: {}", e);
                    }
                }
                "tray_quit" => {
                    desktop_integration::cleanup_waybar_status();
                    app.exit(0);
                }
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let tauri::tray::TrayIconEvent::Click {
                    button: tauri::tray::MouseButton::Left,
                    button_state: tauri::tray::MouseButtonState::Up,
                    ..
                } = event
                {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                }
            })
            .build(app);
    }

    // Obsługa minimalizacji do zasobnika systemowego przy zamykaniu okna
    if let Some(main_window) = app.get_webview_window("main") {
        let main_window_clone = main_window.clone();
        let app_handle = app.handle().clone();
        main_window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = app_handle.state::<AppState>();
                let close_to_tray = state
                    .rt
                    .block_on(async {
                        state
                            .db
                            .get_app_setting("close_to_tray")
                            .await
                            .unwrap_or(None)
                    })
                    .unwrap_or_else(|| "true".to_string());

                if close_to_tray == "true" {
                    api.prevent_close();
                    let _ = main_window_clone.hide();
                }
            }
        });
    }

    Ok(())
}
