//! Inicjalizacja stanu aplikacji, bazy SQLite, klientów integracji, sesji oraz odtwarzania początkowego.

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
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use storage::Database;
use tauri::Manager;
use tracing::info;

/// Inicjalizuje bazę danych, usługi pomocnicze, stan sesji i zasobnik systemowy.
pub fn init_app(
    app: &mut tauri::App,
    rt: Arc<tokio::runtime::Runtime>,
    engine: Arc<AudioEngine>,
) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&data_dir);
    let db_path = data_dir.join("auralune_library.db");
    let cache_dir = data_dir.join("cache");

    let db = rt.block_on(async {
        Database::open(&db_path)
            .await
            .expect("Błąd otwarcia bazy SQLite")
    });

    // Przywrócenie ostatniego stanu kolejki odtwarzania z bazy danych
    if let Ok(Some(saved_queue)) = rt.block_on(async { db.load_queue_state().await }) {
        info!(
            "Wczytano zapisany stan kolejki ({} utworów)",
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

    let scanner = LibraryScanner::new(&cache_dir);
    let mb = Arc::new(MusicBrainzClient::new());
    let cover_archive = Arc::new(CoverArtArchiveClient::new(&cache_dir));

    let mpris = rt.block_on(async {
        match desktop_integration::MprisController::start(engine.clone()).await {
            Ok(controller) => {
                info!("Zainicjalizowano serwis MPRIS D-Bus: org.mpris.MediaPlayer2.auralune");
                Some(Arc::new(controller))
            }
            Err(e) => {
                tracing::warn!("MPRIS D-Bus niedostępny w tej sesji: {}", e);
                None
            }
        }
    });

    // Sprawdź czy korektor graficzny EQ ma być automatycznie włączony przy starcie
    let eq_startup = rt.block_on(async {
        db.get_app_setting("eq_enabled_on_startup")
            .await
            .unwrap_or(None)
    });
    if let Some(val) = eq_startup {
        let enabled = val == "true";
        engine.set_equalizer_enabled(enabled);
    } else {
        engine.set_equalizer_enabled(false);
    }

    // Sprawdź czy ustawienia DSP mają być automatycznie przywracane przy starcie
    let dsp_startup = rt.block_on(async {
        db.get_app_setting("dsp_restore_on_startup")
            .await
            .unwrap_or(None)
    });
    if dsp_startup.as_deref() == Some("true") {
        if let Some(saved_json) = rt.block_on(async {
            db.get_app_setting("dsp_saved_settings")
                .await
                .unwrap_or(None)
        }) {
            #[derive(serde::Deserialize)]
            struct SavedDsp {
                engine: String,
                pitch_semitones: f64,
                tempo_ratio: f64,
                rate_ratio: f64,
            }
            if let Ok(saved) = serde_json::from_str::<SavedDsp>(&saved_json) {
                let target_engine = match saved.engine.as_str() {
                    "RubberBand" => DspEngine::RubberBand,
                    "SoundTouch" => DspEngine::SoundTouch,
                    _ => DspEngine::Bypass,
                };
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
                    "Przywrócono zapisane ustawienia DSP przy starcie: {:?}, pitch={}, tempo={}, rate={}",
                    target_engine,
                    saved.pitch_semitones,
                    saved.tempo_ratio,
                    saved.rate_ratio
                );
            }
        }
    } else {
        // Domyślny silnik DSP przy uruchomieniu (Bypass jako domyślny)
        let default_engine_setting = rt.block_on(async {
            db.get_app_setting("dsp_default_engine")
                .await
                .unwrap_or(None)
        });
        let target_engine = match default_engine_setting.as_deref() {
            Some("RubberBand") => DspEngine::RubberBand,
            Some("SoundTouch") => DspEngine::SoundTouch,
            _ => DspEngine::Bypass,
        };
        let _ = engine.set_dsp_engine(target_engine);
        tracing::info!(
            "Uruchomiono silnik DSP w trybie domyślnym: {:?}",
            target_engine
        );
    }

    // Wczytanie zapisanego rozmiaru bufora wyjściowego audio (domyślnie: 600 ms)
    let saved_audio_buffer =
        rt.block_on(async { db.get_app_setting("audio_buffer_ms").await.unwrap_or(None) });
    if let Some(buf_str) = saved_audio_buffer {
        if let Ok(ms) = buf_str.parse::<u64>() {
            let safe_ms = if ms < 250 { 600 } else { ms };
            let _ = engine.set_audio_buffer_duration_ms(safe_ms);
        }
    }

    // Wczytanie zapisanego rozmiaru bloku przetwarzania DSP (domyślnie: 2048 ramek)
    let saved_dsp_block =
        rt.block_on(async { db.get_app_setting("dsp_block_size").await.unwrap_or(None) });
    if let Some(block_str) = saved_dsp_block {
        if let Ok(size) = block_str.parse::<usize>() {
            let _ = engine.set_dsp_block_size(size);
        }
    }

    // Przywrócenie pełnego stanu sesji odtwarzania (utwór, pozycja, głośność dB, parametry)
    let restore_session_setting = rt.block_on(async {
        db.get_app_setting("restore_session_on_startup")
            .await
            .unwrap_or(None)
    });
    let should_restore_session = restore_session_setting.as_deref() != Some("false");

    if should_restore_session {
        if let Some(session_json) = rt.block_on(async {
            db.get_app_setting("playback_session_state")
                .await
                .unwrap_or(None)
        }) {
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
                // 1. Przywróć głośność w audio engine od samego startu
                if let Some(vol) = session.volume {
                    let clamped = vol.clamp(0.0, 1.0);
                    let _ = engine.set_volume(clamped);
                    info!(
                        "Przywrócono zapisaną głośność sesji: {:.2} ({:.1} dB)",
                        clamped,
                        if clamped <= 0.0001 {
                            -100.0
                        } else {
                            20.0 * clamped.log10()
                        }
                    );
                }

                // 2. Przywrócenie aktywnego utworu ze wznowionej sesji i przygotowanie silnika audio
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
                                id: format!(
                                    "restored-session-{}",
                                    std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_millis()
                                ),
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

                        // Sprawdź czy utwór ze starej sesji to demo "Skrzydła Białe" podczas gdy w bibliotece są już utwory użytkownika
                        let is_demo_session = session.title.as_deref() == Some("Skrzydła Białe")
                            || uri.contains("Skrzydła Białe")
                            || session.track_id.is_none();

                        let has_user_tracks = rt.block_on(async {
                            db.list_tracks()
                                .await
                                .map(|t| !t.is_empty())
                                .unwrap_or(false)
                        });

                        if is_demo_session && has_user_tracks && track_opt.is_none() {
                            if let Some(first_track) = rt.block_on(async {
                                db.list_tracks().await.ok().and_then(|mut t| {
                                    if t.is_empty() {
                                        None
                                    } else {
                                        Some(t.remove(0))
                                    }
                                })
                            }) {
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
                                        "Nie udało się załadować pliku użytkownika do potoku: {}",
                                        e
                                    );
                                }
                            }
                        } else {
                            engine.set_active_item(queue_item.clone());

                            if let Err(e) = engine.load_uri(uri) {
                                tracing::warn!(
                                    "Nie udało się załadować pliku sesji do potoku: {}",
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

    // Utwór demonstracyjny jeśli biblioteka jest pusta
    if engine.current_queue_item().is_none() {
        let track_count =
            rt.block_on(async { db.list_tracks().await.map(|t| t.len()).unwrap_or(0) });
        if track_count == 0 {
            if let Some(sample) = resolve_or_extract_sample_track(&data_dir) {
                tracing::info!(
                    "Brak utworów w bibliotece — załadowano domyślny utwór testowy: {} ({})",
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
                    tracing::warn!("Nie udało się załadować utworu testowego do potoku: {}", e);
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

    let icon_style = rt
        .block_on(async { db.get_app_setting("app_icon_style").await.unwrap_or(None) })
        .unwrap_or_else(|| "lineout".to_string());

    let discord_enabled = rt
        .block_on(async {
            db.get_app_setting("discord_rpc_enabled")
                .await
                .unwrap_or(None)
        })
        .map(|v| v == "true")
        .unwrap_or(true);

    let discord_client_id = rt.block_on(async {
        db.get_app_setting("discord_rpc_client_id")
            .await
            .unwrap_or(None)
    });

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

    let rt_for_cli = rt.clone();
    let app_state = AppState {
        engine,
        db: Arc::new(db),
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
    };

    let state_for_cli = app_state.clone();
    app.manage(app_state);
    crate::setup::spawn_playback_ticker(app.handle().clone());

    let cli_args = std::env::args().collect::<Vec<String>>();
    let initial_files = extract_audio_paths_from_args(&cli_args, None);

    if !initial_files.is_empty() {
        info!("Uruchomiono Auralune z plikami CLI: {:?}", initial_files);
        let app_handle_for_cli = app.handle().clone();
        rt_for_cli.spawn(async move {
            tokio::time::sleep(Duration::from_millis(150)).await;
            enqueue_and_play_files(initial_files, &state_for_cli, &app_handle_for_cli).await;
        });
    }

    let _ = update_system_icons(app.handle(), &icon_style);

    setup_tray_and_window_events(app)?;

    Ok(())
}
