//! Initialisation of app state, the SQLite database, integration clients, the session and initial playback.

use crate::commands::playback::{
    enqueue_and_play_files, extract_audio_paths_from_args, resolve_or_extract_sample_track,
};
use crate::commands::themes::update_system_icons;
use crate::setup::tray::setup_tray_and_window_events;
use crate::AppState;
use audio_engine::AudioEngine;
use domain::queue::QueueItem;
use domain::PlaybackState;
use downloads::DownloadManager;
use dsp_api::{DspEngine, DspParams};
use library::LibraryScanner;
use metadata::{CoverArtArchiveClient, LastFmClient, ListenBrainzClient, MusicBrainzClient};
use std::fs;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use storage::Database;
use tauri::Manager;
use tracing::info;

/// Setting key for the last volume (0.0–1.0); written on quit, read on start-up.
pub const VOLUME_SETTING_KEY: &str = "playback_volume";

/// Initialises the database, helper services, session state and the system tray.
pub fn init_app(
    app: &mut tauri::App,
    rt: Arc<tokio::runtime::Runtime>,
    engine: Arc<AudioEngine>,
    launch_started: std::time::Instant,
) -> Result<(), Box<dyn std::error::Error>> {
    let init_started = std::time::Instant::now();
    let data_dir = app.path().app_data_dir().map_err(|e| {
        let msg = format!("The app data directory is missing: {e}");
        crate::setup::fatal::report_fatal_startup_error(&msg);
        msg
    })?;
    if let Err(e) = fs::create_dir_all(&data_dir) {
        let msg = format!("Cannot create the directory {}: {e}", data_dir.display());
        crate::setup::fatal::report_fatal_startup_error(&msg);
        return Err(msg.into());
    }
    let db_path = data_dir.join("auralune_library.db");
    let cache_dir = data_dir.join("cache");
    crate::media_protocol::init_app_data_dir(data_dir.clone());
    crate::commands::library::init_thumbnail_cache_dir(cache_dir.join("thumbs"));

    let db = match rt.block_on(Database::open(&db_path)) {
        Ok(db) => db,
        Err(e) => {
            let msg = format!("Failed to open the database {}: {}", db_path.display(), e);
            crate::setup::fatal::report_fatal_startup_error(&msg);
            return Err(msg.into());
        }
    };

    // Restore the last playback queue state from the database
    if let Ok(Some(saved_queue)) = rt.block_on(async { db.load_queue_state().await }) {
        info!(
            "Loaded the saved queue state ({} tracks)",
            saved_queue.items.len()
        );
        let loop_mode = saved_queue.loop_mode;
        let shuffle = saved_queue.shuffle;
        let items = saved_queue.items;
        let current_index = saved_queue.current_index;
        engine.restore_queue(items, current_index);
        engine.set_loop_mode(loop_mode);
        engine.set_shuffle(shuffle);
    }

    // All settings in one query instead of a dozen blocking reads on the main thread.
    let settings = rt.block_on(db.list_app_settings()).unwrap_or_default();

    let scanner = LibraryScanner::new(&cache_dir);
    let mb = Arc::new(MusicBrainzClient::new());
    let cover_archive = Arc::new(CoverArtArchiveClient::new(&cache_dir));

    let mpris = rt.block_on(async {
        match desktop_integration::MprisController::start(engine.clone()).await {
            Ok(controller) => {
                info!("Initialised the MPRIS D-Bus service: org.mpris.MediaPlayer2.auralune");
                Some(Arc::new(controller))
            }
            Err(e) => {
                tracing::warn!("MPRIS D-Bus unavailable in this session: {}", e);
                None
            }
        }
    });

    // Check whether the graphic EQ should be enabled automatically on start-up
    let eq_startup = settings.get("eq_enabled_on_startup").cloned();
    if let Some(val) = eq_startup {
        let enabled = val == "true";
        engine.set_equalizer_enabled(enabled);
    } else {
        engine.set_equalizer_enabled(false);
    }

    // Check whether the DSP settings should be restored automatically on start-up
    let dsp_startup = settings.get("dsp_restore_on_startup").cloned();
    if dsp_startup.as_deref() == Some("true") {
        if let Some(saved_json) = settings.get("dsp_saved_settings").cloned() {
            #[derive(serde::Deserialize)]
            struct SavedDsp {
                engine: String,
                pitch_semitones: f64,
                tempo_ratio: f64,
                rate_ratio: f64,
            }
            if let Ok(saved) = serde_json::from_str::<SavedDsp>(&saved_json) {
                let target_engine = DspEngine::from_name(&saved.engine);
                let _ = engine.set_dsp_engine(target_engine);
                if let Ok(params) = DspParams::new(
                    target_engine,
                    saved.pitch_semitones,
                    saved.tempo_ratio,
                    saved.rate_ratio,
                ) {
                    let _ = engine.set_dsp_params(params);
                }
                tracing::info!(
                    "Restored the saved DSP settings on start-up: {:?}, pitch={}, tempo={}, rate={}",
                    target_engine,
                    saved.pitch_semitones,
                    saved.tempo_ratio,
                    saved.rate_ratio
                );
            }
        }
    } else {
        // Default DSP engine on start-up (Bypass by default)
        let default_engine_setting = settings.get("dsp_default_engine").cloned();
        let target_engine =
            DspEngine::from_name(default_engine_setting.as_deref().unwrap_or_default());
        let _ = engine.set_dsp_engine(target_engine);
        tracing::info!(
            "Started the DSP engine in default mode: {:?}",
            target_engine
        );
    }

    // Load the saved audio output buffer size (default: 600 ms)
    let saved_audio_buffer = settings.get("audio_buffer_ms").cloned();
    if let Some(buf_str) = saved_audio_buffer {
        if let Ok(ms) = buf_str.parse::<u64>() {
            let safe_ms = if ms < 250 { 600 } else { ms };
            let _ = engine.set_audio_buffer_duration_ms(safe_ms);
        }
    }

    // Load the saved DSP block size (default: 2048 frames)
    let saved_dsp_block = settings.get("dsp_block_size").cloned();
    if let Some(block_str) = saved_dsp_block {
        if let Ok(size) = block_str.parse::<usize>() {
            let _ = engine.set_dsp_block_size(size);
        }
    }

    // Volume is remembered independently of session restore (written when the app quits).
    let saved_volume = settings
        .get(VOLUME_SETTING_KEY)
        .and_then(|v| v.parse::<f64>().ok())
        .filter(|v| v.is_finite());
    if let Some(vol) = saved_volume {
        let clamped = vol.clamp(0.0, 1.0);
        let _ = engine.set_volume(clamped);
        info!("Restored the saved volume: {:.2}", clamped);
    }

    // Restore the full playback session state (track, position, parameters)
    let restore_session_setting = settings.get("restore_session_on_startup").cloned();
    let should_restore_session = restore_session_setting.as_deref() != Some("false");

    if should_restore_session {
        if let Some(session_json) = settings.get("playback_session_state").cloned() {
            #[allow(dead_code)]
            #[derive(serde::Deserialize, Debug)]
            struct SavedSessionState {
                volume: Option<f64>,
                position_ms: Option<u64>,
                uri: Option<String>,
                track_id: Option<i64>,
                title: Option<String>,
                artist: Option<String>,
                album: Option<String>,
                duration_ms: Option<u64>,
            }

            if let Ok(session) = serde_json::from_str::<SavedSessionState>(&session_json) {
                // 1. Migration: volume from the saved session only when there is no separate setting yet
                if let Some(vol) = session.volume.filter(|_| saved_volume.is_none()) {
                    let clamped = vol.clamp(0.0, 1.0);
                    let _ = engine.set_volume(clamped);
                    info!(
                        "Restored the saved session volume: {:.2} ({:.1} dB)",
                        clamped,
                        if clamped <= 0.0001 {
                            -100.0
                        } else {
                            20.0 * clamped.log10()
                        }
                    );
                }

                // 2. Restore the active track from the resumed session and prepare the audio engine
                if let Some(ref uri) = session.uri {
                    if !uri.is_empty() {
                        let track_opt =
                            rt.block_on(async { db.get_track_by_path(uri).await.ok().flatten() });
                        let album_title = if let Some(ref tr) = track_opt {
                            if let Some(album_id) = tr.album_id {
                                rt.block_on(async {
                                    db.get_album_by_id(album_id)
                                        .await
                                        .ok()
                                        .flatten()
                                        .map(|alb| alb.title)
                                })
                            } else {
                                None
                            }
                        } else {
                            session.album.clone()
                        };

                        let queue_item = if let Some(ref t) = track_opt {
                            QueueItem {
                                id: format!("track-{}", t.id),
                                track_id: Some(t.id),
                                uri: uri.clone(),
                                title: t.title.clone(),
                                artist: t.artist.clone(),
                                album: album_title,
                                duration_ms: (t.duration_ms.max(0)) as u64,
                            }
                        } else {
                            QueueItem {
                                id: crate::commands::queue::new_queue_item_id("restored-session"),
                                track_id: session.track_id,
                                uri: uri.clone(),
                                title: session.title.clone().unwrap_or_else(|| {
                                    std::path::Path::new(uri)
                                        .file_stem()
                                        .and_then(|s| s.to_str())
                                        .unwrap_or("Restored Track")
                                        .to_string()
                                }),
                                artist: session
                                    .artist
                                    .clone()
                                    .unwrap_or_else(|| "Unknown Artist".to_string()),
                                album: session.album.clone(),
                                duration_ms: session.duration_ms.unwrap_or(0),
                            }
                        };

                        // Check whether the old session's track is the "Skrzydła Białe" demo while the library already has user tracks
                        let is_demo_session = session.title.as_deref() == Some("Skrzydła Białe")
                            || uri.contains("Skrzydła Białe")
                            || session.track_id.is_none();

                        let has_user_tracks = rt
                            .block_on(db.count_tracks())
                            .map(|n| n > 0)
                            .unwrap_or(false);

                        if is_demo_session && has_user_tracks && track_opt.is_none() {
                            if let Some(first_track) = rt.block_on(db.first_track()).ok().flatten()
                            {
                                let first_album = if let Some(alb_id) = first_track.album_id {
                                    rt.block_on(async {
                                        db.get_album_by_id(alb_id)
                                            .await
                                            .ok()
                                            .flatten()
                                            .map(|alb| alb.title)
                                    })
                                } else {
                                    None
                                };
                                let user_queue_item = QueueItem {
                                    id: format!("track-{}", first_track.id),
                                    track_id: Some(first_track.id),
                                    uri: first_track.path.clone(),
                                    title: first_track.title,
                                    artist: first_track.artist,
                                    album: first_album,
                                    duration_ms: (first_track.duration_ms.max(0)) as u64,
                                };
                                engine.set_active_item(user_queue_item.clone());
                                if let Err(e) = engine.load_uri(&first_track.path) {
                                    tracing::warn!(
                                        "Failed to load the user's file into the pipeline: {}",
                                        e
                                    );
                                }
                            }
                        } else {
                            engine.set_active_item(queue_item.clone());

                            if let Err(e) = engine.load_uri(uri) {
                                tracing::warn!(
                                    "Failed to load the session file into the pipeline: {}",
                                    e
                                );
                            } else if let Some(pos) = session.position_ms {
                                if pos > 0 {
                                    let _ = engine.seek(Duration::from_millis(pos));
                                }
                            }

                            if let Some(ref m) = mpris {
                                let m_clone = m.clone();
                                let track_info = desktop_integration::MprisTrackInfo {
                                    title: queue_item.title.clone(),
                                    artist: queue_item.artist.clone(),
                                    album: queue_item.album.clone().unwrap_or_default(),
                                    duration_ms: queue_item.duration_ms,
                                    art_url: None,
                                };
                                rt.spawn(async move {
                                    m_clone.update_track(track_info).await;
                                    m_clone.update_playback_status(PlaybackState::Paused).await;
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Demo track when the library is empty
    if engine.current_queue_item().is_none() {
        let track_count = rt.block_on(db.count_tracks()).unwrap_or(0);
        if track_count == 0 {
            if let Some(sample) = resolve_or_extract_sample_track(&data_dir) {
                tracing::info!(
                    "No tracks in the library, loaded the default test track: {} ({})",
                    sample.title,
                    sample.artist
                );
                let queue_item = QueueItem {
                    id: "default-sample-track-skrzydla-biale".to_string(),
                    track_id: None,
                    uri: sample.path.clone(),
                    title: sample.title.clone(),
                    artist: sample.artist.clone(),
                    album: sample.album.clone(),
                    duration_ms: sample.duration_ms,
                };
                engine.set_active_item(queue_item.clone());
                if let Err(e) = engine.load_uri(&sample.path) {
                    tracing::warn!("Failed to load the test track into the pipeline: {}", e);
                }

                if let Some(ref m) = mpris {
                    let m_clone = m.clone();
                    let track_info = desktop_integration::MprisTrackInfo {
                        title: queue_item.title.clone(),
                        artist: queue_item.artist.clone(),
                        album: queue_item.album.clone().unwrap_or_default(),
                        duration_ms: queue_item.duration_ms,
                        art_url: None,
                    };
                    rt.spawn(async move {
                        m_clone.update_track(track_info).await;
                        m_clone.update_playback_status(PlaybackState::Paused).await;
                    });
                }
            }
        }
    }

    let icon_style = settings
        .get("app_icon_style")
        .cloned()
        .unwrap_or_else(|| "lineout".to_string());

    let discord_enabled = settings
        .get("discord_rpc_enabled")
        .cloned()
        .map(|v| v == "true")
        .unwrap_or(true);

    let discord_client_id = settings.get("discord_rpc_client_id").cloned();

    let discord_rpc = Some(desktop_integration::DiscordRpcController::start(
        Some(rt.handle()),
        discord_enabled,
        discord_client_id,
    ));

    let control_ipc = {
        let server = Arc::new(desktop_integration::ControlIpcServer::new(engine.clone()));
        server.start(&rt);
        Some(server)
    };

    let db = Arc::new(db);
    match rt.block_on(db.fail_interrupted_stem_projects()) {
        Ok(n) if n > 0 => info!("Marked {} interrupted stem projects as failed", n),
        Ok(_) => {}
        Err(e) => tracing::warn!("Failed to update the interrupted stem projects: {}", e),
    }
    let queue_saver = crate::commands::queue::QueueSaver::spawn(&rt, engine.clone(), db.clone());
    let rt_for_cli = rt.clone();
    {
        let bg_db = db.clone();
        let bg_data_dir = data_dir.clone();
        rt.spawn(async move {
            let Ok(themes) = bg_db.list_themes().await else {
                return;
            };
            for mut theme in themes {
                let Some(raw) = theme
                    .background_ref
                    .as_deref()
                    .filter(|r| r.trim().starts_with("data:"))
                    .map(str::to_string)
                else {
                    continue;
                };
                let dir = bg_data_dir.clone();
                match tokio::task::spawn_blocking(move || {
                    crate::commands::themes::normalize_background_ref_for_storage(&dir, Some(raw))
                })
                .await
                {
                    Ok(Ok(Some(url))) => {
                        theme.background_ref = Some(url);
                        if let Err(e) = bg_db.save_theme(&theme).await {
                            tracing::warn!(
                                "Failed to save migrated wallpaper URL for theme '{}': {}",
                                theme.id,
                                e
                            );
                        } else {
                            info!("Migrated inline wallpaper for theme '{}' to file", theme.id);
                        }
                    }
                    Ok(Ok(None)) => {}
                    Ok(Err(e)) => {
                        tracing::warn!(
                            "Skipped invalid inline wallpaper migration for theme '{}': {}",
                            theme.id,
                            e
                        );
                    }
                    Err(e) => {
                        tracing::warn!("Wallpaper migration task panicked: {e}");
                    }
                }
            }
        });
    }
    let app_state = AppState {
        engine,
        db,
        queue_saver,
        scanner: Arc::new(scanner),
        rt,
        mpris,
        discord_rpc,
        mb,
        cover_archive,
        listenbrainz: Arc::new(ListenBrainzClient::new()),
        lastfm: Arc::new(LastFmClient::new()),
        downloads: Arc::new(DownloadManager::new()),
        latest_spectrum: Arc::new(Mutex::new(vec![0.0f32; 16])),
        latest_live_stream_tag: Arc::new(Mutex::new(None)),
        discord_cover_cache: Arc::new(std::sync::RwLock::new(std::collections::HashMap::new())),
        last_reported_pos_ms: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        control_ipc,
        last_waybar_write: Arc::new(Mutex::new(std::time::Instant::now())),
        last_status: Arc::new(std::sync::RwLock::new(None)),
        close_to_tray: Arc::new(std::sync::atomic::AtomicBool::new(
            settings
                .get("close_to_tray")
                .map(|v| v != "false")
                .unwrap_or(true),
        )),
        window_revealed: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        window_hidden: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        mpris_volume: Arc::new(crate::commands::playback::MprisVolumeCoalescer::default()),
        cover_worker_notify: Arc::new(tokio::sync::Notify::new()),
        cover_worker_force_run: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        cover_worker_active: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        cover_sync_progress: Arc::new(std::sync::Mutex::new(
            crate::setup::background_covers::CoverSyncProgress::default(),
        )),
    };

    let state_for_cli = app_state.clone();
    app.manage(app_state);
    crate::setup::spawn_playback_ticker(app.handle().clone());
    crate::setup::spawn_update_checker(app.handle().clone());
    crate::setup::spawn_background_cover_worker(app.handle().clone());

    let cli_args = std::env::args().collect::<Vec<String>>();
    let initial_files = extract_audio_paths_from_args(&cli_args, None);

    if !initial_files.is_empty() {
        info!("Started Auralune with CLI files: {:?}", initial_files);
        let app_handle_for_cli = app.handle().clone();
        rt_for_cli.spawn(async move {
            tokio::time::sleep(Duration::from_millis(150)).await;
            enqueue_and_play_files(initial_files, &state_for_cli, &app_handle_for_cli).await;
        });
    }

    // Writing icons and .desktop files and gtk-update-icon-cache does not block the window start-up.
    let icon_handle = app.handle().clone();
    std::thread::spawn(move || {
        let _ = update_system_icons(&icon_handle, &icon_style);
    });

    setup_tray_and_window_events(app)?;

    // Safety reveal: if the frontend never calls `reveal_main_window` (e.g., WebView stalls),
    // show the window after 1200 ms so the user is never left with an invisible window.
    {
        let safety_handle = app.handle().clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(1200));
            if let Some(state) = safety_handle.try_state::<crate::AppState>() {
                crate::commands::system::reveal_main_window_internal(&safety_handle, state.inner());
            }
        });
    }

    info!(
        "app_init finished in {} ms ({} ms since launch)",
        init_started.elapsed().as_millis(),
        launch_started.elapsed().as_millis()
    );

    Ok(())
}
