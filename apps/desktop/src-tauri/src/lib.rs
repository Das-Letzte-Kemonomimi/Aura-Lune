//! Backend desktopowy Auralune (Tauri 2).
//!
//! ZGODNIE Z ZASADĄ ARCHITEKTONICZNĄ:
//! Wątek audio i surowe próbki PCM są całkowicie odizolowane od WebView i bazy danych.
//! Komendy Tauri służą wyłącznie do sterowania odtwarzaczem, odpytywania stanu i indeksowania.

use audio_engine::AudioEngine;
use downloads::DownloadManager;
use library::LibraryScanner;
use metadata::{CoverArtArchiveClient, LastFmClient, ListenBrainzClient, MusicBrainzClient};
use std::sync::{Arc, Mutex};
use storage::Database;
use tauri::Manager;
use tracing::{error, info};

pub mod commands;
pub mod setup;

pub use commands::analysis::*;
pub use commands::bookmarks::*;
pub use commands::devices::*;
pub use commands::dialogs::*;
pub use commands::downloads::*;
pub use commands::dsp::*;
pub use commands::integrations::*;
pub use commands::library::*;
pub use commands::metadata::*;
pub use commands::playback::*;
pub use commands::playlists::*;
pub use commands::queue::*;
pub use commands::renamer::*;
pub use commands::stems::*;
pub use commands::system::*;
pub use commands::themes::*;

#[derive(Clone)]
pub struct AppState {
    pub engine: Arc<AudioEngine>,
    pub db: Arc<Database>,
    pub scanner: Arc<LibraryScanner>,
    pub rt: Arc<tokio::runtime::Runtime>,
    pub mpris: Option<Arc<desktop_integration::MprisController>>,
    pub discord_rpc: Option<Arc<desktop_integration::DiscordRpcController>>,
    pub mb: Arc<MusicBrainzClient>,
    pub cover_archive: Arc<CoverArtArchiveClient>,
    pub listenbrainz: Arc<ListenBrainzClient>,
    pub lastfm: Arc<LastFmClient>,
    pub downloads: Arc<DownloadManager>,
    pub latest_spectrum: Arc<Mutex<Vec<f32>>>,
    pub latest_live_stream_tag: Arc<Mutex<Option<String>>>,
    pub discord_cover_cache: Arc<std::sync::RwLock<std::collections::HashMap<String, String>>>,
    pub last_reported_pos_ms: Arc<std::sync::atomic::AtomicU64>,
    pub control_ipc: Option<Arc<desktop_integration::ControlIpcServer>>,
    pub last_waybar_write: Arc<Mutex<std::time::Instant>>,
    /// Ostatni status odtwarzania wyliczony przez ticker (`setup::playback_ticker`).
    pub last_status: Arc<std::sync::RwLock<Option<commands::playback::PlaybackStatusDto>>>,
}

pub fn run() {
    setup::init_linux_environment();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let rt = Arc::new(tokio::runtime::Runtime::new().expect("Błąd tworzenia runtime tokio"));

    let engine = match AudioEngine::new() {
        Ok(e) => Arc::new(e),
        Err(err) => {
            error!("Nie udało się zainicjalizować silnika audio: {:?}", err);
            panic!("Krytyczny błąd silnika audio: {:?}", err);
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            info!(
                "Wykryto próbę uruchomienia kolejnej instancji Auralune. Args: {:?}, Cwd: {}",
                argv, cwd
            );

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }

            let files = extract_audio_paths_from_args(&argv, Some(&cwd));
            if !files.is_empty() {
                if let Some(state) = app.try_state::<AppState>() {
                    let state_clone = state.inner().clone();
                    let app_handle = app.clone();
                    let rt = state_clone.rt.clone();
                    rt.spawn(async move {
                        enqueue_and_play_files(files, &state_clone, &app_handle).await;
                    });
                }
            }
        }))
        .setup({
            let rt = rt.clone();
            let engine = engine.clone();
            move |app| setup::init_app(app, rt, engine)
        })
        .invoke_handler(tauri::generate_handler![
            load_file,
            play,
            pause,
            stop,
            seek,
            set_pitch,
            set_pitch_semitones,
            set_tempo,
            set_tempo_ratio,
            set_rate,
            set_rate_ratio,
            set_dsp_params,
            reset_dsp,
            set_dsp_engine,
            get_dsp_capabilities,
            save_dsp_preset,
            list_dsp_presets,
            load_dsp_preset,
            set_volume,
            get_status,
            set_equalizer_band,
            set_equalizer_bands,
            set_equalizer_enabled,
            set_equalizer_params,
            set_equalizer_preamp,
            apply_auto_eq_profile,
            get_equalizer_presets,
            get_parametric_eq_state,
            set_parametric_eq_state,
            set_parametric_eq_enabled,
            set_parametric_eq_preamp,
            get_parametric_eq_presets,
            parse_equalizer_apo_config,
            export_equalizer_apo_config,
            get_dynamics_state,
            set_dynamics_state,
            set_compressor_enabled,
            set_saturator_enabled,
            get_dynamics_presets,
            get_replaygain_config,
            set_replaygain_config,
            get_replaygain_status,
            apply_auto_replaygain,
            get_crossfeed_config,
            set_crossfeed_config,
            get_silence_trimming_config,
            set_silence_trimming_config,
            scan_track_replaygain,
            scan_library_replaygain,
            list_devices,
            set_device_profile,
            set_bluetooth_codec,
            enable_pro_audio,
            disable_pro_audio,
            set_card_profile,
            save_lyrics_lrc,
            get_app_setting,
            set_app_setting,
            transcode_file,
            scan_library,
            scan_paths,
            pick_folder,
            pick_files,
            pick_image_file,
            pick_single_audio_file,
            pick_save_destination,
            pick_custom_file,
            open_containing_folder,
            open_external_url,
            get_sample_track,
            get_app_version,
            get_library_tracks,
            get_library_albums,
            get_library_artists,
            save_bookmark,
            get_bookmark,
            delete_bookmark,
            update_mpris_metadata,
            list_themes,
            get_active_theme,
            set_active_theme,
            save_theme,
            update_theme_background,
            export_theme_json,
            import_theme_json,
            upload_background_image,
            search_musicbrainz_releases,
            fetch_and_apply_cover,
            auto_fetch_album_cover,
            search_cover_candidates,
            apply_cover_url,
            apply_custom_cover_file,
            apply_custom_cover_data,
            get_track_cover,
            get_queue,
            set_queue,
            add_to_queue,
            add_uris_to_queue,
            add_next_to_queue,
            remove_from_queue,
            reorder_queue,
            clear_queue,
            play_queue_index,
            play_next,
            play_previous,
            set_loop_mode,
            toggle_shuffle,
            set_shuffle,
            set_active_track,
            set_stop_after_current,
            toggle_stop_after_current,
            get_stop_after_current,
            import_audio_from_url,
            create_playlist,
            save_queue_as_playlist,
            load_radio_stream,
            delete_playlist,
            list_playlists,
            add_track_to_playlist,
            remove_track_from_playlist,
            get_playlist_tracks,
            get_lyrics,
            set_mini_player_mode,
            toggle_favorite,
            record_track_play,
            record_track_listening,
            get_recap_summary,
            reset_track_plays,
            set_reverb_params,
            get_favorite_tracks,
            get_recently_played_tracks,
            get_top_played_tracks,
            get_hires_tracks,
            set_app_icon_style,
            get_app_icon_style,
            detect_track_key_bpm,
            save_track_key_bpm,
            set_track_rating,
            get_track_metadata,
            update_track_metadata,
            is_fpcalc_available,
            identify_track_fingerprint,
            parse_cue_sheet_content,
            list_smart_playlist_tracks,
            show_desktop_notification,
            export_playlist_m3u8,
            import_playlist_m3u8,
            export_profile_backup,
            import_profile_backup,
            validate_listenbrainz_token,
            submit_listenbrainz_playing_now,
            submit_listenbrainz_listen,
            add_download_job,
            cancel_download_job,
            list_download_jobs,
            set_stereo_widener,
            get_stereo_widener,
            set_limiter_enabled,
            is_limiter_enabled,
            set_crossfade_duration,
            get_crossfade_duration,
            get_default_music_dir,
            get_discord_rpc_status,
            set_discord_rpc_enabled,
            set_discord_rpc_client_id,
            get_track_bookmarks,
            add_track_bookmark,
            update_track_bookmark,
            delete_track_bookmark,
            find_duplicate_tracks,
            delete_track_record,
            preview_rename_tracks,
            execute_rename_tracks,
            lastfm_get_auth_url,
            lastfm_fetch_session,
            lastfm_validate_session,
            lastfm_update_now_playing,
            lastfm_scrobble,
            get_audio_system_health,
            set_audio_buffer_duration_ms,
            get_audio_buffer_duration_ms,
            set_dsp_block_size,
            get_dsp_block_size,
            get_analysis_capabilities,
            list_ai_models,
            delete_ai_model,
            download_ai_model,
            get_or_extract_track_waveform,
            detect_track_chords,
            get_cached_chords,
            save_chord_overrides,
            export_chords_file,
            detect_track_transcription,
            get_cached_transcription,
            export_transcription_midi,
            start_stem_separation,
            get_track_stems,
            load_track_stems,
            set_stem_mixer_state,
            get_stem_mixer_state,
            list_model_packs,
            create_stem_project,
            list_stem_projects,
            get_stem_project,
            delete_stem_project,
            rename_stem_project,
            save_stem_project_mix,
            get_stem_project_mixes,
            delete_stem_project_mix,
            load_stem_project,
            restore_original_track,
            apply_stem_project_mix,
            export_stem_project_mix,
            export_stem_project_zip,
        ])
        .run(tauri::generate_context!())
        .expect("Błąd podczas uruchamiania aplikacji Tauri");
}
