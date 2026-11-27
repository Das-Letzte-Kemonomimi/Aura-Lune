# AGENTS.md: Tauri Host (`src-tauri/`)

## Overview

`src-tauri/` is the crate `auralune-desktop`: the Tauri 2 host that wires the core crates in `crates/` together and exposes them to the React frontend as IPC commands and events. It owns app lifecycle (setup, tray, shutdown), the playback ticker that drives the audio engine, and the self-updater. Repository-wide rules are in the root [`AGENTS.md`](../AGENTS.md). Rules for the engine and storage crates are in [`crates/AGENTS.md`](../crates/AGENTS.md). The full command table and updater design are in [`docs/developer/tauri-commands.md`](../docs/developer/tauri-commands.md).

## Module Structure

```
src-tauri/
├── build.rs              # Embeds AURALUNE_BUILD_COMMIT / AURALUNE_BUILD_CHANNEL
├── tauri.conf.json       # Window, bundle, strict CSP + devCsp (guarded by tests)
├── capabilities/         # Tauri v2 permission sets
├── icons/                # App/tray icons (also used by packaging/)
├── src/
│   ├── main.rs           # Entry point, calls lib::run()
│   ├── lib.rs            # Builder: plugins, AppState, generate_handler![…], run events
│   ├── setup/            # app_init, linux_env, playback_ticker, silence_trim, tray,
│   │                     # update_checker, shutdown, fatal
│   ├── commands/         # Command handlers by domain (playback, queue, dsp, library,
│   │                     # playlists, metadata, stems, analysis, themes, updates, …)
│   │   ├── mod.rs        # Re-exports every command module
│   │   ├── error.rs      # CommandError (the only error type commands return)
│   │   └── paths.rs      # ensure_writable / ensure_readable (UI path contract)
│   └── updater/          # Build identity, GitHub release check, AppImage install
└── tests/                # DTO, IPC contract, CommandError, ticker, security, updater, smoke
```

## Adding New Commands

1. Implement the command in the matching `src/commands/<domain>.rs` with `#[tauri::command]`. Use `pub async fn` unless it is trivially non-blocking (see the blocking contract).
2. Return `Result<T, CommandError>` and use `?` on crate errors. DTOs are `#[derive(Serialize, Deserialize)]` structs with `snake_case` fields; the frontend passes camelCase arguments.
3. Make sure the module is re-exported in `src/commands/mod.rs` and glob-imported in `lib.rs`.
4. Register the function in `tauri::generate_handler![…]` in `src/lib.rs`.
5. Run `npm run gen:commands` at the repository root to refresh `src/api/commands.generated.ts`.
6. Call it from the frontend through `src/api/ipc.ts` (see [`src/AGENTS.md`](../src/AGENTS.md)) and add tests: Rust in `tests/`, the hook in Vitest.

A command that no frontend `invoke()` uses is dead: remove the wrapper, but keep the storage/engine method. `tests/ipc_contract_test.rs` checks that every `invoke('…')` in `src/` targets a registered command and that the generated file matches `generate_handler!`.

## Contracts (CRITICAL)

### Error contract

- Every command returns `Result<T, CommandError>` (`commands/error.rs`), serialized as `{ "code": "…", "message": "…" }` with codes `storage | engine | io | not_found | validation | network | internal`.
- `From` impls exist for every crate error (`StorageError`, `AudioEngineError`, `AnalysisError`, `TagError`, `DomainError`, `MetadataError`, `DownloadError`, `LibraryError`, `DspError`, `io::Error`, …), so use `?` directly.
- Add context with `.map_err(|e| CommandError::from(e).context("Failed to …"))`. **Never `.map_err(|e| e.to_string())`**: it flattens the code to `internal`. The frontend `IpcErrorCode` union in `src/api/ipc.ts` must match the codes (`tests/command_error_test.rs`).

### Blocking contract

Tauri runs non-`async` commands on the main thread. Anything that sleeps (fades), spawns a process (`pactl`), decodes audio, or touches engine pipeline state is `pub async fn` and runs its body in `tokio::task::spawn_blocking`: clone `AppState` first. Blocking file I/O inside async commands uses `tokio::fs` or `spawn_blocking`.

### Path contract

Commands that write a file the UI names call `paths::ensure_writable`. Commands that read a file and return or store its content call `paths::ensure_readable(path, &[extensions])`, using `paths::AUDIO_EXTENSIONS` / `paths::IMAGE_EXTENSIONS`. Both resolve symlinks and return a `#[must_use]` `PathBuf`. **Always read or write through the returned path**, never the original string. Tag writes (`update_track_metadata`) resolve the file from `track_id` in the database, not from a UI path. Media URLs (`auralune-media://localhost/...`) carry only database IDs or SHA-256 content hashes (never filesystem paths); protocol handlers validate `{sha}.{ext}` with `domain::paths::is_safe_file_token` + an extension allow-list and resolve paths through `paths::ensure_readable`.

### Playback & state

- `setup/playback_ticker.rs` is **the only driver of the engine bus**: it calls `tick_status` (drains `poll_events`: EOS → next track, loops, spectrum, Waybar), caches the result in `AppState.last_status`, and emits `auralune://playback-status` / `auralune://playback-error`. Commands that need a status call `snapshot_status` (no bus side effects), **never `tick_status`**. Playback must never depend on the webview.
- Queue persistence: `persist_queue_state` only signals `AppState.queue_saver` (`QueueSaver`, one debounced writer, 300 ms). Never spawn ad-hoc save tasks.
- Queue items not from the library get `queue::new_queue_item_id(prefix)` (time + process-wide counter). Never build IDs from a timestamp alone.
- Tray actions and the single-instance handler call the same `*_internal` functions as the commands (`play_internal`, `play_next_internal`, …). Never duplicate the logic.
- `shutdown::on_exit` saves the queue and the master volume synchronously, stops the ticker (waiting for the in-flight tick), the engine and the control IPC.
- Startup failures (DB, app data dir, GStreamer) go through `setup/fatal.rs` (zenity/kdialog message + exit), never `panic!`.

### Updater

- All GitHub traffic runs in Rust. The WebView CSP blocks it, and `tests/security_config_test.rs` must keep passing: never loosen `connect-src`.
- **Channels never cross**: stable compares the `releases/latest` tag with the version (`domain::version`); dev compares the `dev-build` release commit with the embedded commit. An `unknown` commit never reports an update.
- Only https asset URLs on `github.com` / `*.githubusercontent.com`. A SHA-256 (the asset `digest` or a `SHA256SUMS` line) is required, otherwise `install_update` refuses with `validation`. The download is verified, ELF-checked, `chmod 755`'d and atomically renamed over `$APPIMAGE`.
- Self-install only for `app_image_managed` (and `dev_server` on the dev channel); other install kinds get a notice. The background check (`setup/update_checker.rs`) only emits `auralune://update-available`; nothing downloads without the user.

## Platform & Plugins

- Linux-first. `setup/linux_env.rs` sets the GStreamer plugin paths and the WebKit2GTK environment (important inside the AppImage) before the builder runs.
- Plugins are registered in `lib.rs`. **The single-instance plugin is registered first**: it forwards a second launch's audio-file arguments to the running instance.
- The dev and stable channels install side by side. Icons and `.desktop` files use the channel id from `install_identity` (`auralune-dev` for dev), and dev never rewrites stable entries.

## Conventions

| Pattern | Example |
|---|---|
| Command naming | `snake_case` (`get_library_tracks`, not `getLibraryTracks`) |
| Error returns | `Result<T, CommandError>`, never `Result<T, String>` |
| Logging | `tracing::{info, warn, error, debug}`, never `println!` |
| String formatting | `format!("{variable}")`, not `format!("{}", variable)` |
| App handle | Pass `AppHandle` / `State<'_, AppState>`, not `Window`, when possible |
| Locks | `lock_safe()` from `audio_engine::sync`, not `lock().unwrap()` |
| Events | `auralune://<kebab-name>`; the frontend subscribes with `useTauriEvent` |
| Tests | `tests/*.rs` (integration) or `#[cfg(test)] #[path = "…_test.rs"]`, never inline modules |

## Testing

```bash
cargo test -p auralune-desktop                              # all host tests
cargo test -p auralune-desktop --test ipc_contract_test     # invoke() ↔ generate_handler! ↔ generated TS
cargo test -p auralune-desktop --test desktop_smoke_test -- --nocapture
```

`tests/ipc_contract_test.rs` and `tests/command_error_test.rs` read frontend files through `CARGO_MANIFEST_DIR/../src`, so `src/` and `src-tauri/` must stay siblings at the repository root.
