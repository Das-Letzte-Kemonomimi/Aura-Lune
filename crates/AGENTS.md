# AGENTS.md: Core Crates (`crates/`)

## Overview

`crates/` holds the Cargo workspace crates that do the real work: audio playback and DSP, analysis, persistence, library scanning, online metadata, downloads and Linux desktop integration. They know nothing about Tauri. The host in `src-tauri/` ([`src-tauri/AGENTS.md`](../src-tauri/AGENTS.md)) wraps them in commands. Repository-wide rules are in the root [`AGENTS.md`](../AGENTS.md). Module-by-module detail is in [`docs/developer/rust-architecture.md`](../docs/developer/rust-architecture.md).

## Crate Map

| Crate | Responsibility |
|---|---|
| `domain` | Pure models and rules: queue, EQ/parametric EQ, themes, ReplayGain, stems, dynamics, devices, silence, paths, renamer, CUE, transcode, semver. **Zero I/O.** |
| `dsp-api` | `DspEngine` trait, capabilities, pitch/semitone/cent math |
| `dsp-rubberband` / `dsp-soundtouch` | `DspEngine` implementations: high quality (formants) / low latency |
| `audio-engine` | GStreamer 0.25 pipeline (`pipeline/`), the custom `auralune_dsp` element, spectrum, analysis (key/BPM, chords, transcription, waveform, silence, ReplayGain), HPSS, tag editing, devices, models |
| `storage` | SQLite via `sqlx`: schema + versioned migrations, library, playlists/queue, stats, analysis cache, stems, settings |
| `library` | Directory walk + tag reading (`walkdir`, `lofty`), incremental scan, scoped stale cleanup |
| `metadata` | AcoustID, MusicBrainz, Cover Art Archive, Last.fm, ListenBrainz, lyrics; shared HTTP rules |
| `downloads` | Async model/asset downloads with progress, SHA-256 and path checks |
| `desktop-integration` | MPRIS v2, Discord RPC, Waybar status, control FIFO/socket, desktop icons |
| `cli-spike` | Headless CLI for quick engine experiments |

## Real-Time Audio Safety (CRITICAL)

The GStreamer streaming threads (pad probes, the `auralune_dsp` element, `dsp-*` processing) are real-time code:

- **Never** allocate (`Vec::new()`, `Box::new()`, `String`, `format!`), do file or network I/O, log unthrottled, or take a mutex there.
- The one documented exception: `auralune_dsp` holds its state mutex for one buffer, because Rubber Band / SoundTouch need `&mut`. Control-plane code keeps that critical section to a field update or a swap. `prepare()` for a new format or block size runs **outside** the lock, and the prepared processor is swapped in. Bypass is lock-free (atomic engine flag, bit-perfect passthrough).
- Talk to the audio thread through atomics (`AtomicCell`), pre-allocated buffers or lock-free channels. Cache Caps-derived values (channel count) instead of querying them per buffer.
- View buffer bytes as `f32` only through `audio_engine::rt` (`f32_samples`, `map_f32_samples_in_place`, `map_stereo_frames_in_place`, …), which check alignment and fall back to a copy. **Never `slice::from_raw_parts` on buffer bytes.** Rate-limit hot-path logging with `rt::RateLimiter`.
- Lock order in `pipeline/`: `inner` may be held while taking `queue`, **never the reverse**. Use `sync::LockExt::lock_safe()`, not `lock().unwrap()`.
- Build GStreamer URIs only with `audio_engine::uri` (`media_uri`, `media_uri_checked`, `local_path`). Never `format!("file://{path}")`.
- Decoders for analysis go through `analysis::decode::DecodeSession` (timed pulls, bus error check, `Null` on drop). Waveforms stream through `WaveformAccumulator`; never buffer a whole track.

## Per-Crate Rules

- **`domain`**: no filesystem, network or audio access, so everything stays unit-testable. Pure decisions used by the host (`silence::trim_action`, `paths::check_write_target`, `version::is_newer`) live here.
- **`dsp-api`**: map engine names only through `DspEngine::as_str()` / `from_name()` (case-insensitive, unknown → `Bypass`). Never match engine strings by hand.
- **`audio-engine` analysis**: bump `CHORD_ANALYZER_VERSION` / `TRANSCRIPTION_ANALYZER_VERSION` whenever the algorithm changes; cached rows of other versions are then treated as misses. Tunables are named `const`s. Transcription onsets are computed in `f64` from the fractional hop; never truncate them to whole ms. Hash whole audio files with `model_manager::cached_file_sha256` (LRU by path, size, mtime), not `calculate_file_sha256` directly. Long-signal jobs (stems) drop each full-length buffer as soon as it is written.
- **`storage`**:
  - Schema changes are **versioned migrations** in `schema.rs` that bump `PRAGMA user_version`, one transaction per step. Never run raw unversioned `ALTER TABLE` in `init_db()`.
  - Performance PRAGMAs are set per connection in `Database::with_performance_pragmas`, never on the pool.
  - Analysis caches keep exactly one row per track, and a read with a different analyzer version is a miss.
- **`library`**: the walk and tag reading run in `spawn_blocking`; only DB writes stay async. Albums are keyed by `ALBUMARTIST` (falling back to artist). Stale cleanup is scoped to the scanned root and skipped on walk errors, so an unmounted drive never wipes the library.
- **`metadata`**: build clients with `http::build_client(timeout)` and send through `http::send_with_retry`. Respect the per-service rate limiters (MusicBrainz 1/s, AcoustID 3/s). URLs chosen by the UI must pass `net_guard::ensure_public_https_url`. Cover downloads are streamed with the `MAX_COVER_BYTES` cap. `fpcalc` runs with a timeout and `kill_on_drop`.
- **`downloads`**: destinations pass `domain::paths::check_write_target`. `TempFileGuard` removes temp files on every failure. Job IDs and temp names use the process-wide sequence, never time alone.
- **`desktop-integration`**: IPC files (Waybar JSON, control FIFO, socket) live only in the private runtime dir from `runtime_dir::ensure_runtime_dir` (`$XDG_RUNTIME_DIR/auralune/`, 0700, owner checked). MPRIS and socket handlers run engine calls in `spawn_blocking`. `OpenUri` accepts only http(s) streams and existing local audio files.

## Errors

Each crate has its own `thiserror` enum (`AudioEngineError`, `AnalysisError`, `TagError`, `StorageError`, `LibraryError`, `MetadataError`, `DownloadError`, `DomainError`, `DspError`, …). Return those, never `Result<_, String>` or `anyhow` in library code. The host maps them to `CommandError` codes, so pick the variant that describes the failure (`Validation`, `NotFound`, `External`, …).

## Conventions

| Pattern | Example |
|---|---|
| Logging | `tracing` macros, rate-limited on hot paths |
| String formatting | `format!("{variable}")`, off the audio thread only |
| Shared deps | Add versions to `[workspace.dependencies]` in the root `Cargo.toml`, use `dep.workspace = true` |
| File size | Split large modules by theme (see `pipeline/`: graph, probes, source, transport, fades, queue_ops, bus, dsp, effects); keep files under ~450 lines |

## Testing

- **Pattern A**: integration tests in `crates/<crate>/tests/*.rs` (the default). **Pattern B**: a companion `src/<module>_test.rs` included with `#[cfg(test)] #[path = "<module>_test.rs"] mod tests;` when private items are needed (`hpss_test.rs`, `sync_test.rs`). Never inline `mod tests { … }` in production files.
- Run one crate with `cargo test -p <crate>`, and the whole workspace with `cargo test --workspace -- --test-threads=1` (GStreamer tests must not run in parallel).
- Audio fixtures are in the root `tests/fixtures/`. Network tests use a local test server, never real services.
- **Adding a DB column or table**: DDL + a migration step bumping `user_version` in `schema.rs` → fields in `models.rs` → queries in the domain submodule → a test in `crates/storage/tests/` (`schema_migrations_test.rs` for the migration itself).
