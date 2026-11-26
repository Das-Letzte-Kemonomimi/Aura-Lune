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
   - Commands must return `Result<T, String>` or a typed error that implements `serde::Serialize`.
   - Never panic or unwrap errors inside a Tauri command handler; always propagate errors through `Result`.

3. **Thread-Safe State Access**:
   - Shared resources (database connection pools, audio engine channels) must be registered in the Tauri builder:
     ```rust
     .manage(AppState::new(...))
     ```
   - In commands, inject state via `tauri::State<'_, AppState>`.
   - Use non-blocking async operations (`tauri::async_runtime::spawn`) for operations involving disk I/O or network requests.

4. **Event Emission & Cleanup**:
   - Backend-to-frontend updates (playback time, spectrum FFT data, scan progress) use `app_handle.emit("event_name", payload)`.
   - Throttle high-frequency events (e.g. playback progress should emit at 20-30 Hz, not on every audio buffer).
   - Ensure the React frontend unregisters listeners in `useEffect` cleanup routines.

5. **Mandatory Pre-Commit Quality Checks**:
   - Before committing any backend changes, run:
     ```bash
     cargo fmt --all --check
     cargo clippy --workspace --all-targets --all-features -- -D warnings
     cargo test --workspace -- --test-threads=1
     ./tests/run_all_tests.sh
     ```
