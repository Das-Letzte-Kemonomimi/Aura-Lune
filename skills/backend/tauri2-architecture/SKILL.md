---
name: tauri2-architecture
description: 'Best practices for developing and maintaining Tauri 2 IPC commands, state management, and modular architecture in Aura-Lune.'
metadata:
  namespace: backend
---
# Tauri 2 Architecture & IPC Best Practices

This skill guides agents working on the desktop integration and backend IPC layer of Aura-Lune (`src-tauri` and crates).

## Architecture Principles

1. **Modular Command Registration**:
   - Do NOT place hundreds of raw `#[tauri::command]` functions directly inside `src-tauri/src/lib.rs`.
   - Organize commands into submodules under `src-tauri/src/commands/`:
     - `playback.rs`: Play, pause, seek, volume, queue operations.
     - `dsp.rs`: Equalizer bands, pitch, tempo, dynamic presets.
     - `stems.rs`: Stem project creation, isolation models, track mixdown.
     - `library.rs`: Directory scans, SQLite metadata queries, track search.
     - `devices.rs`: PipeWire/PulseAudio sink devices, Bluetooth codec negotiation.

2. **IPC Error Serialization**:
   - Every command must return `Result<T, CommandError>` (`src-tauri/src/commands/error.rs`) and propagate crate errors with `?` or `.map_err(|e| CommandError::from(e).context("Failed to ..."))`.
   - Never return `Result<T, String>`, never flatten errors with `.map_err(|e| e.to_string())`, and never panic or unwrap inside a command handler.

3. **Thread-Safe State & Blocking Contract**:
   - Shared resources (database connection pool, audio engine, `QueueSaver`) are registered via `.manage(AppState::new(...))` and injected with `tauri::State<'_, AppState>`.
   - Any command that sleeps, spawns a process, decodes audio, or touches the engine pipeline must be `pub async fn` and run blocking work inside `tokio::task::spawn_blocking` (clone `AppState` first); async file I/O uses `tokio::fs`.
   - Commands accepting UI file paths must validate through `commands/paths.rs` (`paths::ensure_writable` / `paths::ensure_readable`).

4. **Event Emission & Contracts**:
   - Backend-to-frontend updates use `auralune://<kebab-name>` (e.g. `auralune://playback-status` from `setup/playback_ticker.rs` at 100 ms playing / 250 ms paused).
   - Never call `tick_status` from commands (use `snapshot_status`). Frontend components subscribe via `useTauriEvent` rather than raw `listen()`.

5. **Mandatory Pre-Commit Quality Checks**:
   - After adding, removing, or renaming a Tauri command, regenerate `src/api/commands.generated.ts`:
     ```bash
     npm run gen:commands
     ```
   - Before committing backend changes, run:
     ```bash
     cargo fmt --all --check
     cargo clippy --workspace --all-targets --all-features -- -D warnings
     cargo test --workspace -- --test-threads=1
     ./tests/run_all_tests.sh
     ```
