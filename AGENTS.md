# 🌸 Aura-Lune — Agents & Developer Architecture Guide

This document is the authoritative single source of truth for AI agents and human developers working on the **Aura-Lune** codebase. It details the complete architecture, crate responsibilities, modular database submodules, desktop commands, frontend hooks, state management, testing protocols, and core engineering invariants.

> [!IMPORTANT]
> **CRITICAL DIRECTIVES FOR AGENTS & DEVELOPERS:**
> 1. **Continuous Documentation Synchronization**: Whenever adding, modifying, or refactoring crates, database submodules, Tauri commands, hooks, modals, or architecture patterns, you **must update `AGENTS.md`** within the same task. Keep this document evergreen and accurate.
> 2. **Pragmatic Testing (No Tests for Removed Features)**: Tests must strictly verify active invariants, working functionality, and edge cases. **Never write tests asserting that deliberately removed features, deprecated endpoints, or deleted UI elements do not exist**. Obsolete tests must simply be removed or updated.

---

## 📑 Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Repository Directory Structure](#2-repository-directory-structure)
3. [Rust Backend Crates (`crates/`)](#3-rust-backend-crates-crates)
   - [Domain Layer (`crates/domain`)](#cratesdomain)
   - [DSP Abstraction (`crates/dsp-api`)](#cratesdsp-api)
   - [DSP Implementations (`dsp-rubberband`, `dsp-soundtouch`)](#cratesdsp-rubberband--cratesdsp-soundtouch)
   - [Audio Pipeline Engine (`crates/audio-engine`)](#cratesaudio-engine)
   - [Modular Persistence Layer (`crates/storage`)](#cratesstorage-modular-architecture)
   - [Library Scanner (`crates/library`)](#crateslibrary)
   - [Metadata & Scrobbling (`crates/metadata`)](#cratesmetadata)
   - [Asset Downloader (`crates/downloads`)](#cratesdownloads)
   - [Linux Desktop Integration (`crates/desktop-integration`)](#cratesdesktop-integration)
4. [Tauri Desktop Host (`apps/desktop/src-tauri`)](#4-tauri-desktop-host-appsdesktopsrc-tauri)
   - [Setup & Lifecycle Modules (`setup/`)](#setup--lifecycle-modules-setup)
   - [Modular Command Handlers (`commands/`)](#modular-command-handlers-commands)
5. [Frontend Architecture (`apps/desktop/src`)](#5-frontend-architecture-appsdesktopsrc)
   - [Views & Screens (`src/views`)](#views--screens-srcviews)
   - [Domain Hooks (`src/hooks`)](#domain-hooks-srchooks)
   - [Prop Builder Hooks](#prop-builder-hooks)
   - [Performance & Responsiveness Principles](#performance--responsiveness-principles)
   - [UI Components & Lazy Loaded Modals (`src/components`)](#ui-components--lazy-loaded-modals-srccomponents)
   - [Type Contracts (`src/types`)](#type-contracts-srctypes)
   - [DSP & Audio Math Utilities (`src/utils`)](#dsp--audio-math-utilities-srcutils)
   - [Internationalization (`src/locales` & `src/i18n.ts`)](#internationalization-srclocales--srci18nts)
6. [Modular Test Architecture (`tests/`)](#6-modular-test-architecture-tests)
7. [Core Engineering Invariants & Safety Rules](#7-core-engineering-invariants--safety-rules)
8. [Mandatory Verification Protocol (7-Stage CI Parity)](#8-mandatory-verification-protocol-7-stage-ci-parity)
9. [Agent Operational Recipes](#9-agent-operational-recipes)

---

## 1. High-Level Architecture

Aura-Lune is a Linux-first, Poweramp & foobar2000-inspired music player built with anime aesthetics, audiophile-grade DSP, and real-time stem separation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   React 19 + TypeScript + Vite Frontend                │
│ (Feature Views, Lazy-Loaded Modals, Virtualized Queue, Audio Racks)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC (Tauri v2 non-blocking async invoke)
┌───────────────────────────────────▼────────────────────────────────────┐
│              Tauri v2 Native Host (auralune-desktop)                   │
│   setup/ (app_init, linux_env, tray)                                   │
│   commands/ (playback, dsp, library, stems, metadata, devices, queue,  │
│              playlists, themes, bookmarks, renamer, downloads, etc.)   │
└───────┬──────────────┬──────────────┬──────────────┬───────────┬───────┘
        │              │              │              │           │
┌───────▼────────┐┌────▼────────┐┌────▼─────────┐┌───▼───────┐┌───▼───────┐
│  audio-engine  ││   storage   ││   metadata   ││ downloads ││  desktop-  │
│  (GStreamer)   ││(SQLite/SQLx)││(AcoustID/CAA)││(HTTP HF)  ││integration│
└───────┬────────┘└─────────────┘└──────────────┘└───────────┘└───────────┘
        │
┌───────▼──────────────────────────┐
│ dsp-rubberband / dsp-soundtouch  │
└──────────────────────────────────┘
```

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, `React.lazy` code-splitting.
- **IPC Layer**: Tauri 2.0 with asynchronous `pub async fn` commands in Tokio threadpools.
- **Audio Processing**: GStreamer 0.25 pipeline with bit-perfect bypass, 10-band graphic EQ, biquad parametric EQ, RubberBand/SoundTouch time-stretch/pitch-shift, and multi-track stem playback.
- **Persistence**: SQLite with versioned schema migrations (`PRAGMA user_version`), 64 MB cache, memory temp store, and memory-mapped I/O (`mmap`).

---

## 2. Repository Directory Structure

```
Aura-Lune/
├── apps/
│   └── desktop/                     # Tauri v2 Desktop Application
│       ├── src/                     # React 19 Frontend
│       │   ├── assets/              # Static audio, anime icons, textures
│       │   ├── components/          # Modular component ecosystem
│       │   │   ├── common/          # Shared atomic widgets (LanguageSelector)
│       │   │   ├── layout/          # AppHeader, BottomPlaybackDock, MainContentRouter
│       │   │   ├── library/         # Library subcomponents (FacetsFilterPane)
│       │   │   ├── modals/          # 32 lazy-loaded modal dialogs & AppModalsContainer
│       │   │   └── player/          # Turntable, TapeDeck, VuMeter, Spectrum, Waveform, Lyrics
│       │   ├── api/                 # Typed IPC layer: ipc.ts (invoke/IpcError), settings.ts, commands.generated.ts
│       │   ├── hooks/               # Domain state & prop-builder hooks
│       │   ├── locales/             # Extracted JSON translation dictionaries (en, pl, de, fi, la)
│       │   ├── types/               # TypeScript domain contracts (queue, theme, equalizer, etc.)
│       │   ├── utils/               # DSP math, AutoEQ database, Romaji, harmonic mixing
│       │   ├── views/               # Domain feature screens (player, library, dsp, playlists, stats)
│       │   ├── App.tsx              # Slim, declarative application shell
│       │   ├── i18n.ts              # Translation loader & helper functions
│       │   └── main.tsx             # React DOM root entrypoint
│       └── src-tauri/               # Tauri Rust Backend (crate: auralune-desktop)
│           ├── src/
│           │   ├── commands/        # Modularized Tauri command handlers (214 commands)
│           │   │   ├── analysis.rs  # Key/BPM, chords, waveform peaks, transcription
│           │   │   ├── bookmarks.rs # Track A-B repeat bookmarks & cues
│           │   │   ├── devices.rs   # Audio cards, Bluetooth codecs, master volume
│           │   │   ├── dialogs.rs   # File picker and folder browse dialogs
│           │   │   ├── downloads.rs # Asynchronous file and model downloads
│           │   │   ├── dsp.rs       # Pitch, tempo, rate, EQ bands, AutoEQ, dynamics
│           │   │   ├── integrations.rs # Discord RPC, Waybar, MPRIS status
│           │   │   ├── library.rs   # Scanner, tracks, albums, artists, favorites, stats
│           │   │   ├── metadata.rs  # AcoustID, Cover Art Archive, Last.fm, ListenBrainz
│           │   │   ├── playback.rs  # Play, pause, stop, seek, smooth fade
│           │   │   ├── playlists.rs # Playlist CRUD, smart playlists, M3U8, Radio streams
│           │   │   ├── queue.rs     # Queue management, shuffling, loop modes, reordering
│           │   │   ├── renamer.rs   # File renamer pattern preview & execution
│           │   │   ├── stems.rs     # AI separation, stem mixer, stem projects
│           │   │   ├── system.rs    # Audio health check, process memory, desktop icons
│           │   │   └── themes.rs    # Themes CRUD, wallpaper uploads, anime presets
│           │   ├── setup/           # Application lifecycle & environment configuration
│           │   │   ├── app_init.rs  # DB connection, state init, command-line arguments
│           │   │   ├── linux_env.rs # GStreamer plugin paths & WebKit2GTK configuration
│           │   │   ├── playback_ticker.rs # Backend status loop: bus draining, status events, MPRIS on track change, listening time
│           │   │   ├── silence_trim.rs # Silence trimming (detect + cache + skip lead/trail)
│           │   │   └── tray.rs      # System tray icon, context menu, minimize-to-tray
│           │   ├── lib.rs           # Lightweight Tauri entrypoint (< 350 lines)
│           │   └── main.rs          # Native binary main function
│           ├── tests/
│           │   ├── commands_dto_test.rs # Desktop command DTO & thread-safety test suite
│           │   └── ipc_contract_test.rs # Every frontend invoke() must target a registered command
│           └── Cargo.toml
├── crates/                          # Rust Core Workspaces (11 crates)
│   ├── audio-engine/                # GStreamer pipeline, real-time DSP, stem mixer
│   ├── domain/                      # Pure models & business logic (zero I/O dependencies)
│   ├── dsp-api/                     # Abstract DSP trait definitions and math conversions
│   ├── dsp-rubberband/              # RubberBand high-quality time/pitch stretching
│   ├── dsp-soundtouch/              # SoundTouch low-latency time/pitch stretching
│   ├── storage/                     # SQLite database with 9 domain submodules
│   ├── library/                     # Fast directory scanner & tag extractor (Lofty)
│   ├── metadata/                    # AcoustID, MusicBrainz, Cover Art, Last.fm, ListenBrainz
│   ├── downloads/                   # Threaded model & asset downloader with SHA-256
│   ├── desktop-integration/         # MPRIS D-Bus, Discord RPC, Waybar module, desktop icons
│   └── cli-spike/                   # Headless CLI spike for rapid testing
├── tests/
│   ├── run_all_tests.sh             # 7-stage native test runner (full CI parity)
│   └── desktop_smoke_test.rs        # End-to-end desktop backend integration test
├── install.sh                       # Dual-channel Linux installer (stable & dev channels)
├── DEVELOPMENT.md                   # Environment setup & developer guidelines
├── CHANGELOG_PENDING.md             # Unreleased staging changelog
├── Cargo.toml                       # Root Cargo workspace manifest
└── package.json                     # Root NPM workspace orchestrator
```

---

## 3. Rust Backend Crates (`crates/`)

### `crates/domain`
- **Purpose**: Pure Rust domain entities, data transfer objects, and validation rules. **Zero I/O dependencies** (no file system, network, or audio hardware access).
- **Key Modules**:
  - `queue`: `QueueItem`, `PlaybackQueue`, `LoopMode` (Sequential, Queue, Track).
  - `equalizer`: 10-band graphic EQ presets and gain clamping (`-12.0` to `+12.0 dB`).
  - `parametric_eq`: Biquad filter types (`Peak`, `LowShelf`, `HighShelf`, `LowPass`, `HighPass`, `BandPass`, `Notch`), EqualizerAPO format export and import.
  - `theme`: Anime aesthetic color tokens (`ThemeTokens`), background wallpaper opacity and blur properties.
  - `replaygain`: ReplayGain 2.0 ITU-R BS.1770 modes (`Off`, `Track`, `Album`, `Auto`) and target loudness settings.
  - `stem_project`: Stem channel definitions, volume mappings (`slider_to_linear_gain`, `effective_channel_gain` for mute/solo/master), and mixer presets.
  - `dynamics`: Compressor, Tape Saturator, and Stereo Widener parameters.
  - `device`: `AudioCard`, `BluetoothCodec` (LDAC, aptX HD, AAC, SBC, SBC-XQ).
  - `silence`: `SilenceTrimmingConfig`, `find_silence_bounds` (RMS windows → `SilenceBounds`), `trim_action` (seek past lead / finish at trail).
  - `renamer`: Pattern formatting (`%artist% - %title%`) and path sanitization.
  - `cue`: CUE sheet parser and track splitter.
  - `transcode`: Format choices (`Opus`, `Flac`, `Wav`) and `TimeRange` clipping validation.
- **Tests**: Located in `crates/domain/tests/`:
  - `dsp_models_test.rs`: EQ, parametric EQ, compressor, saturator, crossfeed, silence trimming.
  - `stem_and_library_models_test.rs`: Stem volume mappings, renamer, theme validation, bluetooth codecs.
  - `cue_and_m3u_parsers_test.rs`: CUE pregap calculation and M3U/M3U8 roundtrip export.

### `crates/dsp-api`
- **Purpose**: DSP abstraction layer defining unified traits implemented by DSP backends.
- **Key Items**:
  - `DspEngine`: Common interface for pitch, tempo, and rate manipulation.
  - `DspCapabilities`: Formant preservation capabilities and pitch/tempo bounds.
  - Math helpers: `semitones_to_pitch_ratio()`, `pitch_ratio_to_semitones()`, `cents_to_semitones()`.
- **Tests**: Located in `crates/dsp-api/tests/dsp_api_test.rs`.

### `crates/dsp-rubberband` & `crates/dsp-soundtouch`
- **Purpose**: Native implementations of `DspEngine`.
- **`dsp-rubberband`**: High-fidelity time-stretching and pitch-shifting preserving formants using `librubberband`. Ideal for active listening.
- **`dsp-soundtouch`**: Low-latency, CPU-efficient time-stretching using `libsoundtouch`. Ideal for real-time scrub and DJing.

### `crates/audio-engine`
- **Purpose**: Core real-time playback engine powered by GStreamer 0.25 (`gst-plugins-base`, `gst-plugins-good`).
- **Key Modules & Features**:
  - `pipeline/`: `AudioEngine` orchestrator, split into thematic `impl AudioEngine` blocks (no file > ~450 lines):
    - `mod.rs` — shared state (`PipelineInner`, `StemMixerHandles`), `PlayerEvent`, lock-order rule (`inner` may be held while taking `queue`, never the reverse).
    - `graph.rs` — `AudioEngine::new()`: element creation and linking (post-`queue_sink` `volume` placement for < 15 ms volume latency).
    - `probes.rs` — saturator and stereo widener pad probes (streaming-thread code; config in `AtomicCell`, channel count cached from Caps).
    - `source.rs` — `load_uri`, stems and stem projects (`teardown_source`, `add_stem_mixer`, `add_stem_branch`, `start_stem_source`).
    - `transport.rs` — play/pause/stop/seek (`seek_with_fade`), position math.
    - `fades.rs` — `atomic_volume`, `set_volume_smooth` S-curve, equal-power fades, crossfade, `fade_generation` cancellation.
    - `queue_ops.rs` — queue mutations and track switches (`switch_context`, `fade_out_before_switch`, `start_switched_track`).
    - `bus.rs` — `poll_events` (EOS → stop-after-current / `replay_current` / `advance_after_eos`, errors, tags, spectrum, pre-EOS fade). Called only by the desktop playback ticker.
    - `dsp.rs`, `equalizer.rs`, `effects.rs` — DSP params, graphic/parametric EQ, dynamics, ReplayGain, crossfeed, silence config, widener, limiter.
  - `dsp_node.rs`: Custom `auralune_dsp` element switching Bypass / RubberBand / SoundTouch. **Real-time model:** bypass is lock-free (atomic engine flag, bit-perfect passthrough); processing holds the state lock only for one buffer; `prepare()` for new formats/block sizes runs outside the lock and the processors are swapped in; output blocks are collected on the stack (no per-buffer heap allocation); format comes from the Caps event only.
  - `rt.rs`: Streaming-thread helpers — alignment-checked `f32` views of buffer bytes (`f32_samples`, `map_f32_samples_in_place`, `map_stereo_frames_in_place`, `extend_f32_samples`) with copy fallback, and `RateLimiter` for hot-path logging. Never cast buffer bytes with `slice::from_raw_parts`.
  - `spectrum.rs`: Pure spectrum math (dB normalisation, 64 → 16 perceptual bands, stereo assembly).
  - `analysis.rs`: Key & BPM detection, chord recognition, and transcription.
  - `metadata_editor.rs`: Full tag reading and writing using `lofty`.
  - `model_manager.rs`: AI model catalog and SHA-256 verification.
  - `device.rs`: `DeviceManager` with PipeWire/ALSA card parsing.
  - `hpss.rs`: Harmonic-Percussive Source Separation STFT algorithms with internal unit tests in `src/hpss_test.rs`.
  - `sync.rs`: `LockExt::lock_safe()` — recovers poisoned mutexes; use it instead of `lock().unwrap()` in engine code.
  - `error.rs`: `AudioEngineError` (incl. `Validation`, `Pipeline`, `NotFound`, `External`), `AnalysisError`, `TagError`.
  - `uri.rs`: Single source of truth for path → GStreamer URI conversion (`media_uri`, `media_uri_checked`, `local_path`) with percent-encoding of spaces/non-ASCII and no double encoding. Never build `file://` URIs with `format!`.
- **Tests**: Comprehensive integration suites under `crates/audio-engine/tests/` (`playback_test.rs`, `flac_slow_test.rs`, `metadata_editor_test.rs`, `device_and_model_manager_test.rs`, etc.).

### `crates/storage` (Modular Architecture)
- **Purpose**: SQLite persistence layer built with `sqlx`, partitioned into 9 domain submodules:
  - [`src/models.rs`](file:///home/kamu/Projects/Aura-Lune/crates/storage/src/models.rs): Database records (`TrackRecord`, `AlbumRecord`, `ArtistRecord`, `DspPresetRecord`, `DuplicateGroup`, `RecapSummaryDto`) and `StorageError`.
  - [`src/schema.rs`](file:///home/kamu/Projects/Aura-Lune/crates/storage/src/schema.rs): Table DDL, indices, performance PRAGMAs (`cache_size = -64000`, `temp_store = MEMORY`, `mmap_size = 256MB`), versioned migrations (`PRAGMA user_version`, currently **v3**: v2 = bookmark `ON DELETE CASCADE`, `album_artist` repair, cached chord/transcription `bpm`/`musical_key`/`camelot`; v3 = `track_silence_bounds` cache), default anime themes.
  - [`src/library.rs`](file:///home/kamu/Projects/Aura-Lune/crates/storage/src/library.rs): Track, album, and artist CRUD, metadata updates, duplicate detection.
  - [`src/bookmarks.rs`](file:///home/kamu/Projects/Aura-Lune/crates/storage/src/bookmarks.rs): Track bookmarks and multi-cue timestamp markers.
  - [`src/settings.rs`](file:///home/kamu/Projects/Aura-Lune/crates/storage/src/settings.rs): Key-value app settings, DSP presets, custom theme storage.
  - [`src/playlists.rs`](file:///home/kamu/Projects/Aura-Lune/crates/storage/src/playlists.rs): Playlists CRUD, track ordering, and playback queue persistence (`PlaybackQueue`).
  - [`src/stats.rs`](file:///home/kamu/Projects/Aura-Lune/crates/storage/src/stats.rs): Favorites, ratings, playback history, Recap summaries, and smart playlist queries.
  - [`src/analysis.rs`](file:///home/kamu/Projects/Aura-Lune/crates/storage/src/analysis.rs): Musical analysis cache (chords, beat grid, notes, waveform peaks) and AI model registry.
  - [`src/stems.rs`](file:///home/kamu/Projects/Aura-Lune/crates/storage/src/stems.rs): Stem tracks and multitrack project storage.
  - [`src/lib.rs`](file:///home/kamu/Projects/Aura-Lune/crates/storage/src/lib.rs): Slim facade (74 lines) exposing `Database`.
- **Tests**: Fully separated in `crates/storage/tests/` (`database_crud_test.rs`, `bookmarks_and_cues_test.rs`, `settings_and_dsp_presets_test.rs`, `waveforms_and_transcription_test.rs`, `stem_projects_multitrack_test.rs`, `smart_playlists_and_stats_test.rs`, `playlist_and_queue_persistence_test.rs`, `schema_migrations_test.rs`).

### `crates/library`
- **Purpose**: High-speed local music indexing using `walkdir` and `lofty`. Incremental scanning skips unchanged files using mtime and file size checks.
- **Album grouping**: albums are keyed by the `ALBUMARTIST` tag (falling back to the track artist), so compilations stay a single album.
- **Stale cleanup**: after a complete walk of an existing root, `Database::delete_stale_tracks(root, active_paths)` removes records for files that vanished — scoped to that root only and skipped on walk errors (unmounted drives never wipe the library).
- **Tests**: `crates/library/tests/scanner_test.rs`.

### `crates/metadata`
- **Purpose**: External online metadata enrichment and social scrobbling.
- **Clients**: `AcoustidClient`, `CoverArtArchiveClient`, `LastFmClient`, `ListenBrainzClient`, `lyrics`, `urlencoding`.
- **Tests**: Located in `crates/metadata/tests/` (`acoustid_fingerprint_test.rs`, `scrobbler_test.rs`, `lyrics_parser_test.rs`, `cover_art_archive_test.rs`).

### `crates/downloads`
- **Purpose**: Managed asynchronous HTTP asset downloads (AI separation models) with progress reporting, path traversal protection, and SHA-256 verification.
- **Tests**: Located in `crates/downloads/tests/download_manager_test.rs`.

### `crates/desktop-integration`
- **Purpose**: Linux desktop integration:
  - **MPRIS v2 D-Bus Interface**: Native system media keys, lock screen integration. Handlers run engine calls through `spawn_blocking` (transport methods sleep for micro-fades and must not block the Tokio D-Bus executor); the control socket does the same.
  - **Discord Rich Presence**: Live playback status, elapsed time, album art.
  - **Waybar Custom Module**: Real-time JSON IPC endpoint (`/tmp/auralune.json`).
  - **Desktop Icon Updater**: Switches system and window icons dynamically.
- **Tests**: Located in `crates/desktop-integration/tests/desktop_integration_test.rs`.

---

## 4. Tauri Desktop Host (`apps/desktop/src-tauri`)

The Tauri host binary orchestrates the backend crates and exposes IPC commands to the React frontend.
`apps/desktop/src-tauri/src/lib.rs` is a clean, declarative builder (< 350 lines).

### Setup & Lifecycle Modules (`setup/`)
- [`setup/app_init.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/setup/app_init.rs): Opens SQLite database, restores queue state, initializes MPRIS, Discord RPC, Control IPC, registers `AppState`.
- [`setup/linux_env.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/setup/linux_env.rs): Configures GStreamer plugin directories, scanner path, and WebKit2GTK environment for AppImage.
- [`setup/tray.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/setup/tray.rs): System tray icon, context menu, and close-to-tray handling. Tray actions call the same `*_internal` functions as commands (`play_internal`, `play_next_internal`, …).
- [`setup/playback_ticker.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/setup/playback_ticker.rs): **The only driver of the engine bus.** A dedicated thread (100 ms while playing, 250 ms otherwise) calls `get_status_internal` (drains `poll_events`: EOS → next track, loops, spectrum, Waybar), caches the result in `AppState.last_status`, emits `auralune://playback-status`, syncs MPRIS on automatic track changes, records listening time (`ListeningTracker`) and runs `SilenceTrimmer`. Playback must never depend on the webview polling.
- [`setup/silence_trim.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/setup/silence_trim.rs): Detects silence bounds in the background (`audio_engine::detect_silence_bounds`, cached in `track_silence_bounds`), seeks past leading silence and seeks to just before EOS at trailing silence so the engine's normal EOS path handles loop / stop-after-current / crossfade. Pure decisions live in `domain::silence::{find_silence_bounds, trim_action}`.

### Modular Command Handlers (`commands/`)
All 214 commands are organized by domain under `apps/desktop/src-tauri/src/commands/`:

**Error contract** — every command returns `Result<T, CommandError>` ([`commands/error.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/error.rs)).
`CommandError` serializes to `{ "code": "not_found", "message": "…" }` with codes `storage | engine | io | not_found | validation | network | internal`.
`From` impls exist for every crate error (`StorageError`, `AudioEngineError`, `AnalysisError`, `TagError`, `DomainError`, `ScrobbleError`, `MetadataError`, `DownloadError`, `LibraryError`, `DspError`, `io::Error`, …), so use `?` directly.
Add context with `.map_err(|e| CommandError::from(e).context("Błąd …"))` — never `.map_err(|e| e.to_string())`, which flattens the code to `internal`.

| Module | Responsibility | Key Commands |
|---|---|---|
| [`playback.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/playback.rs) | Playback controls & MPRIS sync; `get_status` returns the ticker snapshot | `play`, `pause`, `stop`, `seek`, `sync_mpris_from_queue_item`, `sync_desktop_playback_state` |
| [`queue.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/queue.rs) | Queue lifecycle, looping, shuffling | `get_queue`, `set_queue`, `add_to_queue`, `add_uris_to_queue`, `add_next_to_queue`, `remove_from_queue`, `reorder_queue`, `clear_queue`, `play_queue_index`, `play_next`, `play_previous`, `set_loop_mode`, `toggle_shuffle`, `set_shuffle`, `set_active_track`, `set_stop_after_current`, `toggle_stop_after_current` (plus `play_next_internal` / `play_previous_internal` for non-command callers) |
| [`dsp.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/dsp.rs) | Pitch, tempo, rate, EQ & AutoEQ, dynamics | `set_pitch`, `set_tempo`, `set_rate`, `set_equalizer_bands`, `set_equalizer_enabled`, `set_parametric_eq_enabled`, `set_compressor_enabled`, `set_saturator_enabled`, `set_limiter_enabled`, `set_crossfeed_enabled`, `set_silence_trimming_enabled`, `set_replaygain_mode` |
| [`library.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/library.rs) | Library scanning, queries & stats | `scan_paths`, `rescan_library`, `get_library_stats`, `get_library_tracks`, `get_library_albums`, `get_library_artists`, `get_favorite_tracks`, `get_recently_played_tracks`, `get_top_played_tracks`, `get_hires_tracks`, `toggle_favorite`, `set_track_rating`, `find_duplicate_tracks`, `delete_track_record` |
| [`playlists.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/playlists.rs) | Playlists, Smart Playlists, Radio & CUE | `create_playlist`, `delete_playlist`, `list_playlists`, `add_track_to_playlist`, `remove_track_from_playlist`, `get_playlist_tracks`, `save_queue_as_playlist`, `list_smart_playlist_tracks`, `export_playlist_m3u8`, `import_playlist_m3u8`, `load_radio_stream`, `parse_cue_sheet_content` |
| [`themes.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/themes.rs) | Themes, wallpapers & system icons | `list_themes`, `get_active_theme`, `set_active_theme`, `save_theme`, `update_theme_background`, `export_theme_json`, `import_theme_json`, `upload_background_image`, `set_app_icon_style`, `get_app_icon_style`, `update_system_icons` |
| [`bookmarks.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/bookmarks.rs) | Track timestamps & A-B repeat bookmarks | `save_bookmark`, `get_bookmark`, `delete_bookmark`, `get_track_bookmarks`, `add_track_bookmark`, `update_track_bookmark`, `delete_track_bookmark` |
| [`metadata.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/metadata.rs) | Tags, MusicBrainz, Covers, Scrobbling | `get_track_metadata`, `update_track_metadata`, `search_musicbrainz_releases`, `fetch_and_apply_cover`, `search_cover_candidates`, `apply_cover_url`, `apply_custom_cover_file`, `get_track_cover`, `get_lyrics`, `validate_listenbrainz_token`, `lastfm_scrobble` |
| [`devices.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/devices.rs) | Audio devices, Bluetooth codecs, Volume | `list_devices`, `set_audio_device`, `get_bluetooth_codecs`, `set_bluetooth_codec`, `get_master_volume`, `set_master_volume`, `set_volume_unit` |
| [`stems.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/stems.rs) | AI models & Stem Project Studio | `start_stem_separation`, `get_track_stems`, `load_track_stems`, `set_stem_mixer_state`, `create_stem_project`, `list_stem_projects`, `get_stem_project`, `delete_stem_project`, `export_stem_project_zip` |
| [`analysis.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/analysis.rs) | Waveforms, Chords, BPM, Transcription | `get_track_waveform`, `analyze_track_key_bpm`, `analyze_track_chords`, `analyze_track_transcription`, `save_chord_override`, `export_chords`, `export_transcription` |
| [`downloads.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/downloads.rs) | Model & asset download jobs | `add_download_job`, `cancel_download_job`, `list_download_jobs`, `remove_model_file` |
| [`renamer.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/renamer.rs) | File renamer pattern engine | `preview_rename_tracks`, `execute_rename_tracks` |
| [`integrations.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/integrations.rs) | Discord RPC & Waybar status | `get_discord_rpc_status`, `set_discord_rpc_enabled`, `trigger_waybar_refresh` |
| [`dialogs.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/dialogs.rs) | Native file & folder pickers | `open_file_dialog`, `open_folder_dialog`, `save_file_dialog` |
| [`system.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/system.rs) | Diagnostics & system info | `get_system_audio_health`, `get_app_memory_stats`, `show_in_file_manager` |

---

## 5. Frontend Architecture (`apps/desktop/src`)

### Views & Screens (`src/views`)
**Section components.** Large views and modals are thin shells that compose section components from a sibling folder (`views/player/sections/`, `views/library/sections/`, `views/dsp/sections/`, `views/player/bigscreen/`, `views/settings/audio/`, `views/settings/transcode/`, `components/modals/parametric-eq/`, `url-import/`, `stem-studio/`). A section's props are typed `Pick<ParentProps, …>` plus the few parent locals it reads, and the parent renders it as `<Section {...props} status={…} />`. Sections that do not draw live progress receive the coarse `status` and are `React.memo`. Keep new UI in a section file; parent views should stay under ~500 lines.

- **`views/player/`**:
  - `PlayerView.tsx`: Main playback screen shell → `sections/` (`PlayerToolbar`, `PlayerVisualColumn`, `PlayerQuickDspVibes`, `PlayerProgressSection`, `PlayerTransportControls`, `PlayerDspMiniBar`, `PlayerQueuePanel`); `queueTrackMeta.ts` resolves queue items to library metadata.
  - `BigScreenView.tsx`: Cinematic full-screen player → `bigscreen/` (HUD, vinyl, tape deck, controls).
- **`views/library/`**:
  - `LibraryView.tsx`: Virtualized library view shell → `sections/` (header, scan panel, toolbar, tracks, album grid, album detail, artists, MusicBrainz match panel). Setter/state prop types come from `ReturnType<typeof useLibraryManager>`.
- **`views/dsp/`**:
  - `DspStudioView.tsx`: Audiophile DSP rack shell → `sections/` (engine selector, pitch/tempo/rate sliders, reverb, presets, mastering rack, graphic EQ).
- **`views/playlists/`**:
  - `PlaylistsView.tsx`: Custom user playlists with M3U8 export/import and smart playlists.
  - `RadioView.tsx`: Live anime, J-Pop, and Lo-Fi internet radio streaming stations.
- **`views/stems/`**:
  - `StemProjectsLibraryView.tsx`: Stem project manager and multi-track separation hub.
- **`views/stats/`**:
  - `StatsDashboardView.tsx`: Listening recap, top artists, play counts, analytics, and direct Recap modal launcher. Routed via `MainContentRouter` when `activeTab === 'stats'`.
- **`views/changelog/`**:
  - `ChangelogView.tsx`: Paginated version history driven by [`src/data/changelog.json`](apps/desktop/src/data/changelog.json) with configurable page sizes (3, 5, 10), first/last, prev/next, and smart ellipsis page navigation.
- **`views/settings/`**:
  - `AppSettingsModal.tsx`: Tabbed settings container.

### Domain Hooks (`src/hooks`)
- **`usePlaybackController`**: Coordinates higher-level play, pause, next, previous, stop, seek, and loop operations.
- **`usePlaybackQueue`**: Queue management, reordering, shuffling, removing, and virtualized queue tracking.
- **`useLibraryManager`**: Library scanning, indexing progress, track loading, and album/artist queries using `useDeferredValue`.
- **`useLibraryPlaybackActions`**: Favorites, track ratings, play count resetting, adding tracks to playlists.
- **`useDspManager`**: DSP engine selection, 10-band graphic EQ, parametric EQ, compressor, saturator, limiter.
- **`useThemeManager`**: Theme tokens, custom wallpaper uploads, overlay opacity, and blur radius.
- **`useModalManager`**: Central modal router supporting typed `open()`, `close()`, `isOpen()`, and `Escape` key handling.
- **`useAudioSettings`**: Audio device selection, buffer sizes, bit-perfect toggle, volume OSD configurations.
- **`usePlaylistManager`**: Playlist CRUD, M3U8 import/export, and radio stations.
- **`useTranscodeManager`**: Audio conversion jobs, background progress tracking, and range exports.
- **`useMusicBrainzManager`**: MusicBrainz release queries, cover art fetching, and manual cover uploads.
- **`useScrobblerManager`**: Last.fm and ListenBrainz session authentication and scrobble dispatch.
- **`useSessionManager`**: App session bootstrap, audio health check, and system diagnostic reporting.
- **`useAmbienceMode`**: Ambient anime particle visualizers (Sakura, Neon Rain, Fireflies, Snow, Matrix Rain, Momiji, Embers).
- **`useVolumeUnit`**: Toggle volume display between percent (`%`) and decibels (`dBFS`).
- **`useInfinityQueue`**: Auto-recommendation queue continuation based on genre and artist similarity.
- **`useHotkeysManager`**: Global keyboard shortcuts coordinator with text-input guard. Registers one `keydown` listener and reads the latest props through a ref.
- **`useTauriEvent`**: Subscribe to a backend event (`useTauriEvent(name, handler, enabled?)`). Always use it instead of raw `listen()` in components/hooks — it keeps the latest handler and unsubscribes even when unmounted before `listen()` resolves.
- **`useSleepTimer`**: Sleep timer countdown/fade-out; interval reads latest values via refs so frequent host re-renders do not reset it.
- **`useVirtualScroll` & `useQueueVirtualScroll`**: Windowed rendering for ultra-large track libraries.

### Prop Builder Hooks
Builders merge domain-hook results ("managers") with values from `App`. Managers are typed as `ReturnType<typeof useXManager>`; merged values are asserted to the intersection of their sources, so every value's **type** is checked, but **completeness** is not. After changing a view's props, check that every value is still provided by a manager or by `App`; missing values are silently `undefined` at runtime (that bug class broke crossfeed, add-to-queue and restore-session before Phase 5).
- **`useAppHeaderProps`**: Assembles props for `AppHeader`.
- **`useBottomPlaybackDockProps`**: Assembles props for `BottomPlaybackDock`.
- **`useMainContentRouterProps`**: Assembles view routing parameters for `MainContentRouter` (including `statsProps`).
- **`useMainRouterProps`**: Bundles child view props (`playerProps`, `libraryProps`, `dspProps`, `playlistsProps`, `statsProps`).
- **`useAppModalsProps`**: Bundles props required by the 32 modals in `AppModalsContainer`.
- **`useAppSettingsModalProps`**: Bundles settings tabs into `AppSettingsModal`.

### Performance & Responsiveness Principles
0. **Live Playback Store (`src/state/livePlayback.ts`)**:
   - Status arrives via the `auralune://playback-status` event (watchdog falls back to `get_status` once per second if events stop).
   - Every frame publishes `position_ms` + `spectrum` to `livePlayback`; React state in `App` is only updated when `shouldCommitStatus` (`src/state/statusCommit.ts`) reports a structural change or a ≥1 s position step.
   - Components that draw progress/visualizers read live values with `useLiveStatus(status)`, `useLivePositionMs(fallback)` or `useLiveSpectrum(fallback)` (PlayerView, BottomPlaybackDock, BigScreenView, DspStudioView, MiniPlayerWidget, DesktopLyricsOverlay, LoopEditorModal, TrackBookmarksModal, MusicAnalysisModal, StemProjectStudioModal). Event handlers needing the exact position call `currentPositionMs(fallback)`. Never read `status.position_ms` for display — it is up to 1 s stale.
   - Per-frame logic (A-B loop) runs inside the status handler in `usePlaybackController`, not in effects on `status`.
1. **Two-Phase Seeking**:
   - `handleSeekPreview(pos)`: Instant 60/120 FPS UI feedback without IPC traffic while dragging (writes only to `livePlayback`, no `App` re-render). Supported across all progress sliders (`<input type="range">`) and animated `WaveformCanvas` visual styles (`smooth`, `bars`, `scrolling`, `mirror`) with pointer capture (`setPointerCapture`) and real-time hover/drag timestamp badges.
   - `handleSeekCommit(pos)`: Dispatched once on pointer/mouse/key up with `seek_with_fade` (20-48ms anti-pop micro-fade).
2. **Dual-Mode Zero-Latency & Smooth Fade Volume Control**:
   - **Post-Queue Pipeline Placement**: In GStreamer, the `volume` element is linked downstream of `queue_sink` (`... -> queue_sink -> volume -> sink`), eliminating 600ms buffer latency so volume adjustments take effect at the hardware sink within < 15ms.
   - **Instant Response Mode (`instantVolume: true`)**:
     - Slider dragging dispatches immediate 0ms initial IPC followed by display-synchronized `requestAnimationFrame` coalesced updates with trailing-edge delivery.
     - Backend `set_volume` operates directly on an atomic value (`< 1 µs`) and sets GStreamer property immediately.
   - **Smooth Fade Mode (`instantVolume: false`)**:
     - Backend `set_volume_smooth` runs an 8ms micro-step S-curve cosine interpolation ramp (default 120ms for jumps/mute, 60ms for slider drag) on a dedicated lightweight thread with instant generation-based cancellation.
     - Frontend animates the visual slider thumb synchronously via `requestAnimationFrame` for silky smooth, click-free audio and UI transitions.
   - **Toggle Mute (`handleToggleMute`)**:
     - In instant mode: snaps immediately to 0 or restores previous level.
     - In smooth mode: smoothly eases out to 0 or eases in from 0 over 120ms.
3. **Interaction Guards Against Rubberbanding**:
   - `isSeekingRef` and `isVolumeInteractingRef` protect the UI state from being overwritten by delayed backend polling responses.
4. **Backend-Driven Status Cadence**:
   - The backend ticker emits status every 100 ms while playing and every 250 ms while paused or stopped; the frontend does not poll.
5. **Background Visualizer Optimization**:
   - `SpectrumVisualizer` and `AnimeAmbienceFX` listen for `document.hidden` and pause animation loops when minimized or hidden.

### UI Components & Lazy Loaded Modals (`src/components`)
- **Modals**: All 32 modal dialogs in `AppModalsContainer.tsx` use `React.lazy()` and `<React.Suspense fallback={null}>` to keep the initial JavaScript bundle small and fast to load.
- **Layout & Player Components**: Extensively wrapped with `React.memo` to prevent unnecessary rerenders during playback time ticks.

### IPC Layer (`src/api`)
- [`api/ipc.ts`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src/api/ipc.ts): the only `invoke` the app may use. Accepts only `CommandName` (generated union of registered commands), rethrows every failure as `IpcError { code, command, message }` (`String(err)` returns the plain message). Helpers: `errorMessage(e)`, `isIpcError(e, code?)`.
- [`api/commands.generated.ts`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src/api/commands.generated.ts): generated by `npm run gen:commands` from `generate_handler!` in `lib.rs`. Never edit by hand; `ipc_contract_test.rs` fails when it is stale.
- [`api/settings.ts`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src/api/settings.ts): `getSetting(key)` / `setSetting(key, value)` over a closed `SettingKey` union. Add new keys to `SETTING_KEYS`.
- oxlint `no-restricted-imports` forbids importing `invoke` from `@tauri-apps/api/core` outside `src/api/`, `src/test/` and test files.
- Tests: `src/test/setup.ts` globally mocks `@tauri-apps/api/core`; import the shared mock with `import { invokeMock } from '../test/ipcMock'` (reset to resolve `undefined` before each test). Do not add per-file `vi.mock('@tauri-apps/api/core')` blocks.

### Type Contracts (`src/types`)
- `queue.ts`: `QueueItem`, `PlaybackQueue`, `QueueColumnConfig`.
- `playlist.ts`: `Playlist`.
- `theme.ts`: `ThemeTokens`, `Theme`.
- `equalizer.ts`: `EqualizerPreset`, `EQUALIZER_BANDS`.
- `player.ts`: `DspEngineType`, `DEFAULT_PLAYBACK_STATUS`; re-exports `TrackRecord`/`AlbumRecord` (from `library.ts`), `PlaybackStatus`/`DspCapabilities` (from `playback.ts`) and `AudioCard` (from `audioDevices.ts`). Define each backend contract **once**, in its domain module.
- `navigation.ts`: `MainTabType` (routed views), `SettingsRedirectTab`, `AppTab`, `SettingsTab`, `isMainTab()`.
- `analysis.ts`: `TrackKeyBpm`, `ChordSegment`, `AiModelInfo`.

### DSP & Audio Math Utilities (`src/utils`)
- `parametricEqMath.ts`: Biquad filter transfer functions, frequency response curves, safe preamp calculations.
- `autoEqDatabase.ts`: Curated database of AutoEQ headphone profiles.
- `harmonicMixing.ts`: Camelot wheel harmonic key matching and musical transposition algorithms.
- `vinylSimulator.ts`: Real-time vinyl record simulation (surface noise, crackles, wow & flutter).
- `soundscapeAudio.ts`: Procedural ambient soundscapes (rain, thunder, cafe, waves, night ambient).
- `romaji.ts`: Transliterates Japanese Kanji, Hiragana, and Katakana titles into Latin Romaji.
- `timeFormat.ts`: Time formatters (`formatTime`, `formatTimeMs`, `parseTimeToMs`).
- `fileSizeFormat.ts`: Human-readable byte formatting (`formatBytes`).

### Internationalization (`src/locales` & `src/i18n.ts`)
Standalone JSON translation dictionaries in `apps/desktop/src/locales/`:
- 🇬🇧 English (`en.json`)
- 🇵🇱 Polish (`pl.json`)
- 🇩🇪 German (`de.json`)
- 🇫🇮 Finnish (`fi.json`)
- 🏛️ Latin (`la.json`)

---

## 6. Modular Test Architecture (`tests/`)

All tests across the workspace are decoupled from production source files into dedicated integration test files under each crate's `tests/` directory:

| Crate | Test Files | Description |
|---|---|---|
| `crates/storage` | `tests/database_crud_test.rs`<br>`tests/bookmarks_and_cues_test.rs`<br>`tests/settings_and_dsp_presets_test.rs`<br>`tests/waveforms_and_transcription_test.rs`<br>`tests/stem_projects_multitrack_test.rs`<br>`tests/smart_playlists_and_stats_test.rs`<br>`tests/playlist_and_queue_persistence_test.rs`<br>`tests/schema_migrations_test.rs` (incl. silence cache) | Full SQLite persistence and query test suite |
| `crates/domain` | `tests/dsp_models_test.rs`<br>`tests/stem_and_library_models_test.rs`<br>`tests/cue_and_m3u_parsers_test.rs`<br>`tests/queue_test.rs`<br>`tests/silence_trim_test.rs` | Domain entities, parsers, and DSP model math |
| `crates/audio-engine` | `tests/playback_test.rs`<br>`tests/flac_slow_test.rs`<br>`tests/opus_and_transcode_test.rs`<br>`tests/metadata_editor_test.rs`<br>`tests/device_and_model_manager_test.rs`<br>`tests/dsp_boundary_and_concurrency_test.rs`<br>`tests/uri_test.rs`<br>`tests/silence_detection_test.rs`<br>`tests/dsp_node_test.rs`<br>`tests/rt_helpers_test.rs`<br>`tests/spectrum_test.rs`<br>`src/hpss_test.rs`<br>`src/sync_test.rs` | GStreamer playback, bit-perfect bypass & DSP output length/PTS, aligned/unaligned sample casts, spectrum pooling, lock-order deadlock regression, URI encoding, DSP switching, tag editing, FFT |
| `crates/metadata` | `tests/acoustid_fingerprint_test.rs`<br>`tests/scrobbler_test.rs`<br>`tests/lyrics_parser_test.rs`<br>`tests/cover_art_archive_test.rs` | Network services, LRC parsing, AcoustID |
| `crates/downloads` | `tests/download_manager_test.rs` | Model download jobs & path traversal checks |
| `crates/desktop-integration` | `tests/desktop_integration_test.rs`<br>`tests/discord_rpc_test.rs`<br>`tests/mpris_test.rs`<br>`tests/waybar_and_ipc_test.rs` | MPRIS, Discord RPC, Waybar atomic status |
| `crates/dsp-api` | `tests/dsp_api_test.rs` | DSP parameters, semitone & cent math |
| `crates/library` | `tests/scanner_test.rs` | Incremental scan, album-artist grouping, scoped stale-track cleanup |
| `apps/desktop/src-tauri` | `tests/commands_dto_test.rs`<br>`tests/ipc_contract_test.rs`<br>`tests/command_error_test.rs`<br>`tests/playback_ticker_test.rs` | DTO validation, `AppState` Send+Sync safety, frontend `invoke()` ↔ `generate_handler!` ↔ `commands.generated.ts` contract, `CommandError` JSON shape and code mapping |

---

## 7. Core Engineering Invariants & Safety Rules

When writing or refactoring code in Aura-Lune, agents **must strictly adhere** to the following rules:

1. **Audio Thread Real-Time Safety**:
   - The audio callback thread in `audio-engine` and `dsp-*` **must never perform heap allocations (`Vec::new()`, `Box::new()`, `String`), file I/O, network requests, or mutex locks**.
   - Current exception, by design: the `auralune_dsp` processing path takes its state mutex for one buffer, because Rubber Band / SoundTouch need exclusive `&mut` access. Control-plane code must keep that critical section to a field update or a swap — never `prepare()`, allocation or I/O under the lock (see `dsp_node.rs`).
   - Use lock-free atomics, pre-allocated ring buffers, or crossbeam channels to communicate between GUI/worker threads and the audio processing thread.
2. **Early Returns Policy**:
   - Favor guard clauses and early returns (`if !valid { return Err(...); }` or `if (!isOpen) return null;`) over deeply nested conditional blocks.
3. **Zero Python Dependencies**:
   - The test infrastructure and build pipeline must strictly remain native Rust (`cargo test`) and TypeScript (`vitest run`). Do not introduce Python scripts or test harnesses.
4. **Toolchain Baseline**:
   - **Node.js**: Node.js 22 LTS (`.nvmrc` pinned to `22`) and npm >= 10 / pnpm 10.
   - **Rust**: Rust stable (edition 2021, toolchain 1.85+) with `rustfmt` and `clippy`.
5. **IPC Parity & Type Safety**:
   - When modifying a Tauri command in `commands/`, verify that both the backend handler and the corresponding frontend `invoke()` calls match signatures.
   - After adding/removing/renaming a command run `npm run gen:commands` (in `apps/desktop`); `tsc` then rejects stale command names in the frontend.
   - Commands return `Result<T, CommandError>`; crates return their own `thiserror` enums — no `Result<_, String>` in new code.
5a. **Frontend type & lint baseline**:
   - `tsconfig.app.json` / `tsconfig.node.json` run with `strict: true`.
   - oxlint: `react-hooks/exhaustive-deps` is an **error** (intentional mount-only effects need an `oxlint-disable-next-line` with a reason); `typescript/no-explicit-any` warns outside tests. Use `catch (e: unknown)` with `errorMessage(e)` from `src/api/ipc`.
6. **No Inline `#[cfg(test)]` in Production Sources**:
   - Place unit and integration tests in the crate's `tests/` directory (Pattern A), or in a companion `_test.rs` file referenced via `#[cfg(test)] #[path = "..."]` (Pattern B).
7. **Continuous Documentation Synchronization (`AGENTS.md`)**:
   - Whenever introducing new crates, database submodules, Tauri commands, frontend hooks, modals, or architectural refactorings, agents and developers **must update this `AGENTS.md` guide as part of the task closure**. Never leave documentation out-of-sync with active code.
8. **Pragmatic Testing & No Tests for Removed Features**:
   - Tests must verify active invariants, functional contracts, boundary conditions, and error recovery paths.
   - **Never write or retain tests that assert the non-existence of intentionally removed features** (e.g. testing that a deleted function does not exist or verifying that an obsolete UI element cannot be found). When a feature is deprecated or removed, delete or update its obsolete tests rather than creating tests asserting its removal. Keep the test suite clean, reasonable, and maintainable.

---

## 8. Mandatory Verification Protocol (7-Stage CI Parity)

> [!CAUTION]
> **MANDATORY PRE-COMMIT & COMPLETION PROTOCOL FOR ALL AGENTS**
> Before committing any changes or declaring a task complete, every agent **MUST** run the code quality, linting, and verification commands below.
> 
> **CI enforces `-D warnings` and `--all-features`**. Any clippy warning, formatting mismatch, Vitest failure, or TypeScript error will cause GitHub Actions to fail. No task is done until all checks pass with **0 errors and 0 warnings**.

### Pre-Commit Fast One-Liner (Run from Repository Root)
```bash
./tests/run_all_tests.sh
```

#### The 7 Stages Verified by `run_all_tests.sh`:
1. **Rust Formatting**: `cargo fmt --all --check`
2. **Frontend Linting & Vitest Suite**: `oxlint` + all Vitest test suites
3. **Frontend TypeScript & Vite Production Build**: `tsc -b && vite build`
4. **Rust Clippy**: `cargo clippy --workspace --all-targets --all-features -- -D warnings`
5. **Rust Workspace Tests**: `cargo test --workspace -- --test-threads=1`
6. **Desktop Smoke Integration Test**: `desktop_smoke_test`
7. **Shell Scripts Syntax Validation**: `bash -n` across all `.sh` scripts

#### Useful Script Flags:
- `./tests/run_all_tests.sh --fix`: Automatically runs `cargo fmt` before checking.
- `./tests/run_all_tests.sh --fast`: Runs checks without long-running audio playback tests.
- `./tests/run_all_tests.sh --bundle`: Tests local AppImage bundling if dependencies are present.

---

## 9. Agent Operational Recipes

### How to Add a New Tauri Command
1. Implement the command function in the relevant module under `apps/desktop/src-tauri/src/commands/` (e.g. `commands/queue.rs`).
2. Mark it `#[tauri::command]` and `pub async fn` (or `pub fn`).
3. Re-export it in `apps/desktop/src-tauri/src/commands/mod.rs` and `pub use commands::my_module::*;` in `lib.rs`.
4. Register the command name in the `tauri::generate_handler![...]` macro list in `lib.rs`.
5. Return `Result<T, CommandError>` (see `commands/error.rs`); use `?` on crate errors.
6. Run `npm run gen:commands` in `apps/desktop` to refresh `src/api/commands.generated.ts`.
7. Call `invoke('command_name', { ... })` imported from `src/api/ipc` in the frontend hook or component.
8. Run `./tests/run_all_tests.sh` to verify.

### How to Add a New Modal Dialog
1. Add the modal identifier to `ModalId` in [`apps/desktop/src/hooks/useModalManager.ts`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src/hooks/useModalManager.ts).
2. Create your modal component under `apps/desktop/src/components/modals/MyNewModal.tsx`.
3. Export it in `apps/desktop/src/components/modals/index.ts`.
4. Register its lazy-loaded import (`React.lazy`) and conditional render in [`AppModalsContainer.tsx`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src/components/modals/AppModalsContainer.tsx).
5. Open the modal anywhere via `modalManager.open('my_modal', optionalPayload)`.

### How to Add Database Columns or Tables
1. Define the table DDL or new column in `crates/storage/src/schema.rs`.
2. Add a versioned migration step in `schema.rs` bumping `PRAGMA user_version` (never run raw unversioned `ALTER TABLE` in `init_db()`).
3. Add the struct fields and serialization in `crates/storage/src/models.rs`.
4. Implement the query methods in the respective domain submodule (`library.rs`, `playlists.rs`, etc.).
5. Add test coverage in `crates/storage/tests/`.

### How to Record & Update Changelog Entries
1. **During Active Development**:
   - Record every user-facing change, fix, and refactor in [`CHANGELOG_PENDING.md`](./CHANGELOG_PENDING.md) under Polish headings (`Dodano`, `Poprawiono`, `Zmieniono`).
2. **On Release (Version Bump)**:
   - Move entries from `CHANGELOG_PENDING.md` into [`CHANGELOG.md`](./CHANGELOG.md) under a new version heading (`## [X.Y.Z] — „Kryptonim” - YYYY-MM-DD`).
   - Add the structured release object at the beginning of the array in [`apps/desktop/src/data/changelog.json`](./apps/desktop/src/data/changelog.json).
   - Ensure the structure matches `ChangelogRelease`:
     ```json
     {
       "version": "1.1.6",
       "codename": "Release Codename",
       "date": "YYYY-MM-DD",
       "author": "Author Name",
       "added": [
         {
           "title": { "en": "Feature title", "pl": "Tytuł funkcji" },
           "desc": { "en": "Description", "pl": "Opis" }
         }
       ],
       "fixed": [
         {
           "title": { "en": "Fix title", "pl": "Tytuł poprawki" },
           "desc": { "en": "Description", "pl": "Opis" }
         }
       ]
     }
     ```
   - **Never hardcode entries into `ChangelogView.tsx`**: `ChangelogView.tsx` automatically consumes `changelog.json`, manages pagination, and provides multi-language support.
   - Run `vitest run src/views/changelog/ChangelogView.test.tsx` and `vitest run src/i18n.test.ts`.

---
*Maintained by Das Letzte Kemonomimi & Aura-Lune Core Engineering Agents.*
