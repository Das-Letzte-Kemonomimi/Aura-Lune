# Tauri Host & Commands

Reference for the Tauri host crate `auralune-desktop` in `src-tauri/`. Rules agents must follow live in [`src-tauri/AGENTS.md`](../../src-tauri/AGENTS.md).

The Tauri host binary orchestrates the backend crates and exposes IPC commands to the React frontend.
`src-tauri/src/lib.rs` is a clean, declarative builder.

## Setup & Lifecycle Modules (`setup/`)
- [`setup/app_init.rs`](../../src-tauri/src/setup/app_init.rs): Opens SQLite database, restores queue state, initializes MPRIS, Discord RPC, Control IPC, registers `AppState`.
- [`setup/linux_env.rs`](../../src-tauri/src/setup/linux_env.rs): Configures GStreamer plugin directories, scanner path, and WebKit2GTK environment for AppImage.
- [`setup/tray.rs`](../../src-tauri/src/setup/tray.rs): System tray icon, context menu, and close-to-tray handling. Tray actions call the same `*_internal` functions as commands (`play_internal`, `play_next_internal`, …).
- [`setup/playback_ticker.rs`](../../src-tauri/src/setup/playback_ticker.rs): **The only driver of the engine bus.** A dedicated thread (100 ms while playing, 250 ms otherwise) calls `tick_status` (drains `poll_events`: EOS → next track, loops, spectrum, Waybar; `PlayerEvent::Error` is emitted as `auralune://playback-error`), caches the result in `AppState.last_status`, emits `auralune://playback-status`, syncs MPRIS on automatic track changes, records listening time (`ListeningTracker`) and runs `SilenceTrimmer`. Playback must never depend on the webview polling. Commands that need a status call `snapshot_status` (no bus side effects) — never `tick_status`. `shutdown::on_exit` calls `stop_playback_ticker()`, which waits for the in-flight tick.
- [`setup/shutdown.rs`](../../src-tauri/src/setup/shutdown.rs): `RunEvent::Exit` handler — saves the final queue and the master volume (`playback_volume` setting, restored by `app_init` at startup independently of session restore) synchronously, stops the engine and control IPC, removes the Waybar file.
- `setup/fatal.rs`: startup failures (DB, app data dir, GStreamer) show a zenity/kdialog error and exit instead of panicking.
- Queue persistence: `persist_queue_state` only signals `AppState.queue_saver` (`QueueSaver`, single debounced writer, 300 ms). Never spawn ad-hoc save tasks.
- [`setup/update_checker.rs`](../../src-tauri/src/setup/update_checker.rs): tokio task started by `init_app`: first check `STARTUP_DELAY_SECS` (30 s) after startup so launch is not slowed, then every `CHECK_INTERVAL_SECS` (6 h); skipped when `update_check_enabled` = `false` and in debug builds without `APPIMAGE` (`DevServer`). It only emits `auralune://update-available` (`UpdateInfo`); nothing is downloaded without the user.
- [`setup/silence_trim.rs`](../../src-tauri/src/setup/silence_trim.rs): Detects silence bounds in the background (`audio_engine::detect_silence_bounds`, cached in `track_silence_bounds`), seeks past leading silence and seeks to just before EOS at trailing silence so the engine's normal EOS path handles loop / stop-after-current / crossfade. Pure decisions live in `domain::silence::{find_silence_bounds, trim_action}`.

## Modular Command Handlers (`commands/`)
All commands are organized by domain under `src-tauri/src/commands/`:

**Dead commands** — a command no frontend `invoke()` uses is removed (the storage/engine method stays). The cleanup in Phase 6 removed 31 such wrappers.

**Path contract** — commands that write a file the UI names call `paths::ensure_writable`; commands that read a file and return or store its content call `paths::ensure_readable(path, &[extensions])` (both in `commands/paths.rs`, symlinks resolved first). Both return the resolved `PathBuf` (`#[must_use]`) — always read/write through the returned path, never the original string. Use `paths::AUDIO_EXTENSIONS` / `paths::IMAGE_EXTENSIONS` for the extension lists. Tag writes (`update_track_metadata`) resolve the file from `track_id` in the database, not from the UI path.

**Blocking contract** — Tauri runs non-`async` commands on the main thread. Anything that sleeps (fades), spawns a process (`pactl`), decodes, or touches the engine pipeline state is `pub async fn` and runs its body in `tokio::task::spawn_blocking` (clone `AppState` first). Blocking file I/O inside async commands uses `tokio::fs` or `spawn_blocking`.

**Queue item IDs** — items not from the library get `queue::new_queue_item_id(prefix)` (time + process-wide counter). Never build IDs from a timestamp alone.

**Error contract** — every command returns `Result<T, CommandError>` ([`commands/error.rs`](../../src-tauri/src/commands/error.rs)).
`CommandError` serializes to `{ "code": "not_found", "message": "…" }` with codes `storage | engine | io | not_found | validation | network | internal`.
`From` impls exist for every crate error (`StorageError`, `AudioEngineError`, `AnalysisError`, `TagError`, `DomainError`, `ScrobbleError`, `MetadataError`, `DownloadError`, `LibraryError`, `DspError`, `io::Error`, …), so use `?` directly.
Add context with `.map_err(|e| CommandError::from(e).context("Błąd …"))` — never `.map_err(|e| e.to_string())`, which flattens the code to `internal`.

| Module | Responsibility | Key Commands |
|---|---|---|
| [`playback/`](../../src-tauri/src/commands/playback/mod.rs) | Playback controls, status ticker (`status.rs`), & MPRIS/Discord sync (`desktop_sync.rs`); `get_status` returns the ticker snapshot | `play`, `pause`, `stop`, `seek`, `sync_mpris_from_queue_item`, `sync_desktop_playback_state` |
| [`queue.rs`](../../src-tauri/src/commands/queue.rs) | Queue lifecycle, looping, shuffling | `get_queue`, `set_queue`, `add_to_queue`, `add_uris_to_queue`, `add_next_to_queue`, `remove_from_queue`, `reorder_queue`, `clear_queue`, `play_queue_index`, `play_next`, `play_previous`, `set_loop_mode`, `toggle_shuffle`, `set_shuffle`, `set_active_track`, `toggle_stop_after_current` (plus `play_next_internal` / `play_previous_internal` for non-command callers) |
| [`dsp.rs`](../../src-tauri/src/commands/dsp.rs) | Pitch, tempo, rate, EQ & AutoEQ, dynamics | `apply_dsp_profile` (whole vibe preset — engine, tempo, pitch, rate, EQ — in one IPC call), `set_pitch`, `set_tempo`, `set_rate`, `set_equalizer_bands`, `set_equalizer_enabled`, `set_limiter_enabled`, `set_crossfeed_enabled`, `set_silence_trimming_enabled`, `set_replaygain_config` |
| [`library.rs`](../../src-tauri/src/commands/library.rs) | Library scanning, queries & stats | `scan_paths`, `rescan_library`, `get_library_stats`, `get_library_tracks`, `get_library_albums`, `toggle_favorite`, `set_track_rating`, `find_duplicate_tracks`, `delete_track_record` |
| [`playlists.rs`](../../src-tauri/src/commands/playlists.rs) | Playlists, Smart Playlists, Radio & CUE | `create_playlist`, `delete_playlist`, `list_playlists`, `add_track_to_playlist`, `remove_track_from_playlist`, `get_playlist_tracks`, `save_queue_as_playlist`, `export_playlist_m3u8`, `import_playlist_m3u8`, `load_radio_stream`, `parse_cue_sheet_content` |
| [`themes.rs`](../../src-tauri/src/commands/themes.rs) | Themes, wallpapers & system icons | `list_themes`, `get_active_theme`, `set_active_theme`, `update_theme_background`, `export_theme_json`, `import_theme_json`, `upload_background_image`, `set_app_icon_style`, `get_app_icon_style`, `update_system_icons` (icons/.desktop written under the channel id from `install_identity`: `auralune-dev` when `AURALUNE_CHANNEL=dev` or the AppImage path says dev; dev never rewrites stable `.desktop` entries) |
| [`bookmarks.rs`](../../src-tauri/src/commands/bookmarks.rs) | Track timestamps & A-B repeat bookmarks | `save_bookmark`, `get_bookmark`, `delete_bookmark`, `get_track_bookmarks`, `add_track_bookmark`, `update_track_bookmark`, `delete_track_bookmark` |
| [`metadata.rs`](../../src-tauri/src/commands/metadata.rs) | Tags, MusicBrainz, Covers, Scrobbling | `get_track_metadata`, `update_track_metadata`, `search_musicbrainz_releases`, `fetch_and_apply_cover`, `search_cover_candidates`, `apply_cover_url`, `apply_custom_cover_file`, `get_track_cover`, `get_lyrics`, `validate_listenbrainz_token`, `lastfm_scrobble` |
| [`devices.rs`](../../src-tauri/src/commands/devices.rs) | Audio devices, Bluetooth codecs, Volume | `list_devices`, `set_audio_device`, `get_bluetooth_codecs`, `set_bluetooth_codec`, `get_master_volume`, `set_master_volume`, `set_volume_unit` |
| [`stems.rs`](../../src-tauri/src/commands/stems.rs) | AI models & Stem Project Studio | `start_stem_separation`, `get_track_stems`, `load_track_stems`, `set_stem_mixer_state`, `create_stem_project`, `list_stem_projects`, `get_stem_project`, `delete_stem_project`, `export_stem_project_zip` |
| [`analysis.rs`](../../src-tauri/src/commands/analysis.rs) | Waveforms, Chords, BPM, Transcription | `get_track_waveform`, `analyze_track_key_bpm`, `analyze_track_chords`, `analyze_track_transcription`, `save_chord_override`, `export_chords`, `export_transcription_midi` (`track_id`, `export_path`: writes the `.mid` itself through `paths::ensure_writable`; the UI picks the path with `pick_save_destination`) |
| [`downloads.rs`](../../src-tauri/src/commands/downloads.rs) | Model & asset download jobs | `add_download_job`, `cancel_download_job`, `list_download_jobs`, `remove_model_file` |
| [`renamer.rs`](../../src-tauri/src/commands/renamer.rs) | File renamer pattern engine | `preview_rename_tracks`, `execute_rename_tracks` |
| [`integrations.rs`](../../src-tauri/src/commands/integrations.rs) | Discord RPC & Waybar status | `get_discord_rpc_status`, `set_discord_rpc_enabled`, `trigger_waybar_refresh` |
| [`dialogs.rs`](../../src-tauri/src/commands/dialogs.rs) | Native file & folder pickers | `open_file_dialog`, `open_folder_dialog`, `save_file_dialog` |
| [`system.rs`](../../src-tauri/src/commands/system.rs) | Diagnostics & system info | `get_system_audio_health`, `get_app_memory_stats`, `show_in_file_manager` |
| [`updates.rs`](../../src-tauri/src/commands/updates.rs) | Channel-aware updates (see below) | `get_build_info`, `get_cached_update_info`, `check_for_update(force)`, `install_update`, `restart_after_update` |

**Updates** (`commands/updates.rs` + `src/updater/`) — all GitHub traffic runs in Rust (the WebView CSP blocks it; `security_config_test.rs` must keep passing, never loosen `connect-src` for this):
- **Build identity**: `build.rs` embeds `AURALUNE_BUILD_COMMIT` (env → `GITHUB_SHA` → `git rev-parse HEAD` → `unknown`) and `AURALUNE_BUILD_CHANNEL` (env, else `dev` when the version has a `-dev` suffix); read through `updater::{BUILD_COMMIT, BUILD_CHANNEL, current_build_info}`. The effective channel is `dev` when `install_identity` says so (`AURALUNE_CHANNEL`/AppImage path) or the build is dev.
- **Channels never cross**: stable → `GET releases/latest`, compare `tag_name` with the version via `domain::version`; dev → `GET releases/tags/dev-build`, compare `target_commitish` (resolved through `commits/{ref}` when it is a branch name) with the embedded commit; an `unknown` commit never reports an update.
- **Install kinds** (`updater::InstallKind`, from `APPIMAGE`, `$HOME`, writability, build profile): `app_image_managed` (AppImage directly in `~/.local/share/auralune{,-dev}/`, writable), `app_image_other`, `system` (AUR/deb), `dev_server`. `updater::can_self_install` allows `app_image_managed` plus `dev_server` on the dev channel (target: `~/.local/share/auralune-dev/auralune-dev.AppImage`, see `install_target`); others get a notice only and `install_update` rejects them. `crates/downloads` destinations accept `auralune`, `auralune-dev` and `com.auralune.player` under both `$XDG_DATA_HOME`/`$XDG_CACHE_HOME` and `~/.local/share`/`~/.cache`.
- **Throttle**: settings `update_last_checked` (unix s) and `update_last_result` (`UpdateInfo` JSON, valid only for the same version+commit+install kind); a non-forced check inside 6 h returns the cache (`updater::should_check`). Rate limits (`403/429` + `X-RateLimit-*`) map to a `network` error.
- **Release contract**: every release carries `SHA256SUMS` (`sha256sum`), uploaded by `ci.yml` (`publish-dev-release` uploads `dev` AppImage + `Auralune-dev-x86_64.AppImage`; `publish-stable-release` uploads the stable AppImage + `.deb` as a draft first and only then publishes). The checksum is the asset API `digest` (`sha256:…`) or, failing that, the `SHA256SUMS` line for the asset (`check::resolve_sha256`); with neither, installation is refused (`validation`).
- **Install**: asset URL must be https on `github.com`/`*.githubusercontent.com`; the `crates/downloads` `HttpDownloadProvider` streams to `<appimage>.update` next to `$APPIMAGE` with SHA-256 verification, then ELF check, `chmod 755` and atomic `rename` over `$APPIMAGE` (progress: `auralune://update-progress`). `restart_after_update` spawns a detached `sh -c 'sleep 2; exec launcher'` (launcher `~/.local/bin/auralune{,-dev}`, else the AppImage; the delay lets the single-instance lock go), then `app.exit(0)` so `shutdown::on_exit` saves state.

## Adding a new Tauri command

1. Implement the command function in the relevant module under `src-tauri/src/commands/` (e.g. `commands/queue.rs`).
2. Mark it `#[tauri::command]` and `pub async fn` (or `pub fn`).
3. Re-export it in `src-tauri/src/commands/mod.rs` and `pub use commands::my_module::*;` in `lib.rs`.
4. Register the command name in the `tauri::generate_handler![...]` macro list in `lib.rs`.
5. Return `Result<T, CommandError>` (see `commands/error.rs`); use `?` on crate errors.
6. Run `npm run gen:commands` in `the repository root` to refresh `src/api/commands.generated.ts`.
7. Call `invoke('command_name', { ... })` imported from `src/api/ipc` in the frontend hook or component.
8. Run `./tests/run_all_tests.sh` to verify.

