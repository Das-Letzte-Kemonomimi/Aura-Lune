//! System tray setup and main window event handling.

use crate::AppState;
use tauri::Manager;

/// Sets up the system tray icon and menu, and minimising to the tray when the window closes.
pub fn setup_tray_and_window_events(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // System tray initialisation on the Linux desktop
    let show_i =
        tauri::menu::MenuItem::with_id(app, "tray_show", "🌸 Show Auralune", true, None::<&str>)?;
    let play_i = tauri::menu::MenuItem::with_id(
        app,
        "tray_play_pause",
        "⏯️ Play / Pause",
        true,
        None::<&str>,
    )?;
    let next_i =
        tauri::menu::MenuItem::with_id(app, "tray_next", "⏭️ Next Track", true, None::<&str>)?;
    let prev_i =
        tauri::menu::MenuItem::with_id(app, "tray_prev", "⏮️ Previous Track", true, None::<&str>)?;
    let quit_i = tauri::menu::MenuItem::with_id(app, "tray_quit", "🚪 Quit", true, None::<&str>)?;
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
                    // The same paths as the UI commands: MPRIS, Discord and the queue save stay consistent,
                    // and the UI gets the new status from the playback ticker event.
                    let state = app.state::<AppState>();
                    let result = if state.engine.state() == domain::PlaybackState::Playing {
                        crate::commands::playback::pause_internal(&state)
                    } else {
                        crate::commands::playback::play_internal(&state)
                    };
                    if let Err(e) = result {
                        tracing::warn!("Tray: play/pause failed: {}", e);
                    }
                }
                "tray_next" => {
                    let state = app.state::<AppState>();
                    if let Err(e) = crate::commands::queue::play_next_internal(&state) {
                        tracing::warn!("Tray: next track failed: {}", e);
                    }
                }
                "tray_prev" => {
                    let state = app.state::<AppState>();
                    if let Err(e) = crate::commands::queue::play_previous_internal(&state) {
                        tracing::warn!("Tray: previous track failed: {}", e);
                    }
                }
                "tray_quit" => {
                    // Clean-up (ticker, Waybar, IPC) is done by `shutdown::on_exit`.
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

    // Minimise to the system tray when the window closes
    if let Some(main_window) = app.get_webview_window("main") {
        let main_window_clone = main_window.clone();
        let app_handle = app.handle().clone();
        main_window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Value from memory (updated by `set_app_setting`), with no database query
                // and no `block_on` on the main thread on every window close.
                let state = app_handle.state::<AppState>();
                if state
                    .close_to_tray
                    .load(std::sync::atomic::Ordering::Relaxed)
                {
                    api.prevent_close();
                    let _ = main_window_clone.hide();
                }
            }
        });
    }

    Ok(())
}
