# 🌸 Aura-Lune — Agents & Developer Architecture Guide

This document is the single source of truth for AI agents and human developers working on the **Aura-Lune** codebase. It details the complete architecture, crate responsibilities, frontend components, state hooks, testing protocols, and core engineering invariants.

---

## 📑 Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Repository Directory Structure](#2-repository-directory-structure)
3. [Rust Backend Crates (`crates/`)](#3-rust-backend-crates-crates)
4. [Tauri Desktop Backend (`apps/desktop/src-tauri`)](#4-tauri-desktop-backend-appsdesktopsrc-tauri)
5. [Frontend Architecture (`apps/desktop/src`)](#5-frontend-architecture-appsdesktopsrc)
   - [Domain Hooks (`src/hooks`)](#domain-hooks-srchooks)
   - [Type Definitions (`src/types`)](#type-definitions-srctypes)
   - [Audio & DSP Utilities (`src/utils`)](#audio--dsp-utilities-srcutils)
   - [UI Components & Modals (`src/components`)](#ui-components--modals-srccomponents)
   - [Internationalization (`src/i18n.ts`)](#internationalization-srci18nts)
6. [Core Engineering Invariants & Safety Rules](#6-core-engineering-invariants--safety-rules)
7. [Testing & Verification Protocols](#7-testing--verification-protocols)
8. [Agent Operational Recipes](#8-agent-operational-recipes)

---

## 1. High-Level Architecture

Aura-Lune is a Linux-first, Poweramp & foobar2000-inspired music player built with anime aesthetics, audiophile-grade DSP, and real-time stem separation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   React 19 + TypeScript + Vite Frontend                │
│  (Custom Themes, Waveform Canvas, Modal Manager, Virtualized Queue)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC (Tauri v2 invoke / events)
┌───────────────────────────────────▼────────────────────────────────────┐
│              Tauri v2 Native Host (auralune-desktop)                   │
│   commands/ (playback, dsp, library, stems, metadata, devices)         │
└───────┬──────────────┬──────────────┬──────────────┬───────────┬───────┘
        │              │              │              │           │
┌───────▼────────┐┌────▼─────┐┌───────▼────────┐┌────▼─────┐┌───▼───────┐
│  audio-engine  ││ storage  ││    metadata    ││downloads││  desktop-  │
│  (GStreamer)   ││ (SQLite) ││(AcoustID/Cover)││  (HTTP)  ││integration│
└───────┬────────┘└──────────┘└────────────────┘└──────────┘└───────────┘
        │
┌───────▼──────────────────────────┐
│ dsp-rubberband / dsp-soundtouch  │
└──────────────────────────────────┘
```

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide icons.
- **IPC Layer**: Tauri 2.0 with type-safe commands organized under `apps/desktop/src-tauri/src/commands/`.
- **Audio Processing**: GStreamer 0.25 pipeline with bit-perfect bypass, 10-band graphic EQ, parametric EQ, RubberBand/SoundTouch time-stretch/pitch-shift, and multi-track stem playback.
- **Persistence**: SQLite via `sqlx` (asynchronous, embedded, zero-configuration).

---

## 2. Repository Directory Structure

```
Aura-Lune/
├── apps/
│   └── desktop/                     # Tauri v2 Desktop Application
│       ├── src/                     # React 19 Frontend
│       │   ├── assets/              # Static audio, anime icons, textures
│       │   ├── components/          # 50+ specialized UI widgets and modal dialogs
│       │   ├── hooks/               # Extracted domain hooks (useAudioPlayer, usePlaybackQueue, etc.)
│       │   ├── types/               # TypeScript domain contracts (queue, theme, equalizer, etc.)
│       │   ├── utils/               # DSP math, AutoEQ database, Romaji, harmonic mixing
│       │   ├── App.tsx              # Main application shell and UI layout
│       │   ├── i18n.ts              # Multilingual translations (EN, PL, DE, FI, LA)
│       │   └── main.tsx             # React DOM root entrypoint
│       └── src-tauri/               # Tauri Rust Backend (crate: auralune-desktop)
│           ├── src/
│           │   ├── commands/        # Modularized Tauri command handlers
│           │   │   ├── mod.rs       # Module registry
│           │   │   ├── playback.rs  # Play, pause, stop, seek, MPRIS sync
│           │   │   ├── dsp.rs       # Pitch, tempo, rate, EQ bands & AutoEQ
│           │   │   ├── library.rs   # Scanner, folders, tracks, albums, artists
│           │   │   ├── stems.rs     # AI separation, stem mixer, stem projects
│           │   │   ├── metadata.rs  # AcoustID, Cover Art Archive, Scrobbling
│           │   │   └── devices.rs   # Audio cards, Bluetooth codecs, Discord RPC
│           │   ├── lib.rs           # Tauri builder, state setup, command routing
│           │   └── main.rs          # Native binary entrypoint
│           └── Cargo.toml
├── crates/                          # Rust Core Workspaces (11 crates)
│   ├── audio-engine/                # GStreamer pipeline, real-time DSP, stem mixer
│   ├── domain/                      # Pure models & business logic (zero I/O dependencies)
│   ├── dsp-api/                     # Abstract DSP trait definitions and math conversions
│   ├── dsp-rubberband/              # RubberBand high-quality time/pitch stretching
│   ├── dsp-soundtouch/              # SoundTouch low-latency time/pitch stretching
│   ├── storage/                     # SQLite database with SQLx migrations
│   ├── library/                     # Fast directory scanner & tag extractor (Lofty)
│   ├── metadata/                    # AcoustID, MusicBrainz, Cover Art, Last.fm, ListenBrainz
│   ├── downloads/                   # Threaded model & asset downloader with SHA-256
│   ├── desktop-integration/         # MPRIS D-Bus, Discord RPC, Waybar module, desktop icons
│   └── cli-spike/                   # Headless CLI spike for rapid testing
├── tests/
│   ├── run_all_tests.sh             # 4-stage native test runner (zero Python dependencies)
│   └── desktop_smoke_test.rs        # End-to-end desktop backend integration test
├── .plans/                          # Architectural plans & refactoring roadmaps
├── AGENTS.md                        # This developer & agent guide
├── Cargo.toml                       # Root Cargo workspace manifest
└── package.json                     # Root NPM workspace orchestrator
```

---

## 3. Rust Backend Crates (`crates/`)

### `crates/domain`
- **Purpose**: Pure Rust domain entities, data transfer objects, and validation rules. **Has NO I/O dependencies** (no file system, network, or audio hardware access).
- **Key Modules**:
  - `queue`: `QueueItem`, `PlaybackQueue`, `LoopMode`.
  - `equalizer`: 10-band graphic EQ presets and clamping limits.
  - `parametric_eq`: Biquad filter types (Peaking, LowShelf, HighShelf, etc.), EqualizerAPO format export/import.
  - `theme`: Anime aesthetic color tokens (`ThemeTokens`), background wallpaper opacity and blur properties.
  - `replaygain`: ReplayGain 2.0 ITU-R BS.1770 modes and target loudness settings.
  - `stem_project`: Stem channel definitions, volume mappings, and mixer presets.
  - `dynamics`: Compressor, Tape Saturator, and Stereo Widener parameters.
  - `device`: `AudioCard`, `BluetoothCodec` (LDAC, aptX HD, AAC, SBC).
  - `renamer`: Pattern formatting (`%artist% - %title%`) and path sanitization.
  - `cue`: CUE sheet parser and track splitter.

### `crates/dsp-api`
- **Purpose**: DSP abstraction layer. Defines the unified traits implemented by DSP backends.
- **Key Traits & Functions**:
  - `DspEngine`: Common interface for pitch, tempo, and rate manipulation.
  - `DspCapabilities`: Reflects min/max ranges and formant preservation capabilities.
  - Math helpers: `semitones_to_ratio()`, `cents_to_ratio()`, `ratio_to_semitones()`.

### `crates/audio-engine`
- **Purpose**: Core real-time playback engine powered by GStreamer 0.25 (`gst-plugins-base`, `gst-plugins-good`).
- **Key Features**:
  - Gapless playback and crossfading between queued tracks.
  - Bit-perfect bypass mode (zero DSP overhead).
  - Multi-track Stem Project playback: synchronizes up to 8 parallel audio stems in real time with individual volume, mute, and solo controls.
  - Key & BPM detection, chord analysis, and offline transcription to MIDI.
  - Device manager integration with PipeWire / ALSA.

### `crates/dsp-rubberband` & `crates/dsp-soundtouch`
- **Purpose**: Native implementations of `DspEngine`.
- **`dsp-rubberband`**: High-fidelity time-stretching and pitch-shifting preserving formants using `librubberband`. Ideal for listening.
- **`dsp-soundtouch`**: Low-latency, CPU-efficient time-stretching using `libsoundtouch`. Ideal for real-time scrub and DJing.

### `crates/storage`
- **Purpose**: SQLite persistence layer built with `sqlx`.
- **Data Stored**:
  - Audio tracks, albums, artists, genres, years, bitrates, sample rates.
  - Playlists and custom track orderings.
  - Play statistics (play counts, skip counts, last played timestamps).
  - Stem projects, channel file paths, and custom mixer snapshots.
  - Bookmarks with timestamp notes.
  - App settings (language, active theme, Discord client ID).

### `crates/library`
- **Purpose**: High-speed local music indexing and metadata extraction.
- **Key Features**:
  - Fast recursive directory traversal with `walkdir`.
  - Comprehensive tag extraction using `lofty` (ID3v2, Vorbis Comments, MP4/AAC tags, FLAC metadata).
  - Incremental scanning: skips unmodified files via timestamp and file size checks.

### `crates/metadata`
- **Purpose**: External online metadata enrichment and social scrobbling.
- **Key Clients**:
  - `AcoustidClient`: Audio fingerprinting via `fpcalc` and AcoustID lookup.
  - `CoverArtArchiveClient`: Automatic high-resolution album cover search and local disk caching.
  - `LastFmClient`: Session key exchange, Now Playing updates, and track scrobbling.
  - `ListenBrainzClient`: User token validation and scrobble submission.
  - `lyrics`: Synchronized LRC file parsing, generation, and storage.

### `crates/downloads`
- **Purpose**: Managed asynchronous HTTP asset downloads (e.g. AI separation models from Hugging Face).
- **Key Features**:
  - Real-time download progress callbacks.
  - Strict SHA-256 integrity validation upon completion.
  - Path-traversal attack prevention (guards against `../` path exploits).

### `crates/desktop-integration`
- **Purpose**: Deep integration with modern Linux desktop environments (GNOME, KDE Plasma, Hyprland, Sway).
- **Key Features**:
  - **MPRIS v2 D-Bus Interface**: Native system media controls, keyboard media keys, and lock screen player widget.
  - **Discord Rich Presence**: Displays current track, artist, album, live playback time, and album art on Discord.
  - **Waybar Custom Module**: Real-time JSON IPC endpoint for status bars.
  - **Desktop Icon Updater**: Dynamically switches desktop and window icons between `lineout` (anime neon) and `classic`.

---

## 4. Tauri Desktop Backend (`apps/desktop/src-tauri`)

The Tauri host binary orchestrates the backend crates and exposes IPC commands to the React frontend.

Before finishing work run `cargo fmt --all` to ensure formatting has no errors. 

### Command Structure (`src/commands/`)
Commands are modularized into focused domains rather than dumped into `lib.rs`:

| Module | Responsibility | Key Exported Functions |
|---|---|---|
| [`playback.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/playback.rs) | Playback controls & MPRIS sync | `play_internal`, `pause_internal`, `stop_internal`, `seek_internal`, `sync_mpris_from_queue_item` |
| [`dsp.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/dsp.rs) | Pitch, tempo, and Equalizer controls | `set_pitch_internal`, `set_tempo_internal`, `set_equalizer_bands_internal`, `apply_auto_eq_profile_internal` |
| [`library.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/library.rs) | Local library scanning & queries | `scan_paths_internal`, `get_library_tracks_internal`, `get_library_albums_internal` |
| [`stems.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/stems.rs) | AI models & Stem Project Studio | `start_stem_separation_internal`, `create_stem_project_internal`, `export_stem_project_zip_internal` |
| [`metadata.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/metadata.rs) | Fingerprinting, Cover Art, Scrobbling | `identify_track_fingerprint_internal`, `apply_cover_url_internal`, `lastfm_scrobble_internal` |
| [`devices.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/devices.rs) | PipeWire audio cards, Discord RPC | `list_devices_internal`, `enable_pro_audio_internal`, `set_discord_rpc_enabled_internal` |

---

## 5. Frontend Architecture (`apps/desktop/src`)

### Domain Hooks (`src/hooks`)
All stateful logic is encapsulated into custom hooks with dedicated Vitest suites:
- **`useAudioPlayer`**: Controls volume, playback state (Play/Pause/Stop), position tracking, and DSP pitch/tempo parameters.
- **`usePlaybackQueue`**: Manages track queue items, active index, loop modes (`None`, `Track`, `Queue`), shuffling, and reordering.
- **`useThemeEngine`**: Loads anime theme presets, handles custom wallpaper uploads, controls backdrop blur and dark overlay opacity, and supports JSON theme import/export.
- **`useModalManager`**: Typed modal router supporting `open()`, `close()`, `toggle()`, `isOpen()`, and global `Escape` key dismissal.
- **`useVirtualScroll`**: Smooth, high-performance windowed list rendering for music libraries containing tens of thousands of tracks.
- **`useHotkeysManager`**: Global keyboard shortcuts coordinator with text-input guard, volume step scaling, and playback shortcuts.
- **`usePlaylistManager`**: Complete playlist lifecycle, M3U/M3U8 import/export, track addition/removal, and custom internet radio stations.
- **`useTranscodeManager`**: Audio format transcoding (Opus/FLAC/WAV), background job progress tracking, loop/bookmark range export, and DSP application during export.

### Type Definitions (`src/types`)
Shared TypeScript contracts live in `src/types/` rather than inline in components:
- `queue.ts`: `QueueItem`, `PlaybackQueue`, `QueueColumnConfig`, `DEFAULT_QUEUE_COLUMNS`, `getQueueGridTemplate`.
- `playlist.ts`: `Playlist` (id, name, track_count, created_at, modified_at).
- `theme.ts`: `ThemeTokens`, `Theme`.
- `equalizer.ts`: `EqualizerPreset`, `EQUALIZER_BANDS`.
- `player.ts`: `PlaybackState`, `DspEngineType`, `PlaybackStatus`, `TrackRecord`, `AlbumRecord`, `DspPresetRecord`, `ReleaseCandidateDto`, `SampleTrackDto`.
- `analysis.ts`: `TrackKeyBpm`, `ChordSegment`, `AiModelInfo`.

### Audio & DSP Utilities (`src/utils`)
- `parametricEqMath.ts`: Computes biquad filter transfer functions, frequency response curves, and safe preamp adjustments.
- `autoEqDatabase.ts`: Curated database of AutoEQ profiles for hundreds of popular audiophile headphones (Sennheiser, Beyerdynamic, Moondrop, Audio-Technica).
- `harmonicMixing.ts`: Camelot wheel harmonic key matching and musical transposition algorithms.
- `vinylSimulator.ts`: Real-time vinyl record simulation (surface noise, dust crackles, 33/45 RPM wow & flutter).
- `soundscapeAudio.ts`: Procedural ambient soundscape generator (rain, thunder, cafe, waves, night ambient).
- `romaji.ts`: Transliterates Japanese Kanji, Hiragana, and Katakana titles into readable Latin Romaji.

### Extracted Views (`src/views`)
Decomposed from the original monolithic `App.tsx`:
- **`PlayerView.tsx`**: Main player view with turntable, tape deck, VU meter, waveform, and transport controls.
- **`LibraryView.tsx`**: Virtualized library view with tracks, albums, artists, facets, search, and sorting.
- **`DspStudioView.tsx`**: Comprehensive DSP studio with equalizer, pitch/tempo/rate sliders, reverb, stereo widener, and compressor.
- **`PlaylistsView.tsx`**: Playlist management, M3U8 import/export, and radio stations.
- **`settings/`**: Modular settings views bundled by `AppSettingsModal.tsx`:
  - `AudioDevicesSettingsView.tsx`: Audio cards, buffer size, DSP block size, ReplayGain, and bit-perfect settings.
  - `BackupSettingsView.tsx`: Profile backup/restore, Discord RPC, Last.fm, and ListenBrainz scrobbling.
  - `ThemesSettingsView.tsx`: Theme picker, custom wallpaper upload, blur/overlay sliders, and JSON theme import/export.
  - `TranscodeSettingsView.tsx`: Audio conversion tool, format/bitrate selectors, and range export.
  - `AboutSettingsView.tsx`: Application info, health check trigger, and onboarding.

### UI Components & Modals (`src/components`)
- **Layout & Shell (`src/components/layout`)**:
  - `AppHeader.tsx`: Application top bar with navigation tabs, version info, quick tools, and scale toggles.
  - `AppNavbar.tsx`: Main view navigation tabs (Player, Library, Playlists, DSP, Radio, etc.).
  - `BottomPlaybackDock.tsx`: Floating mini-player dock with scrub bar and volume popover.
  - `BackgroundLayer.tsx`: Background image/video renderer with blur and overlay controls.
  - `DragDropOverlay.tsx`: Global drag-and-drop file overlay.
  - `QueueDrawer.tsx`: Flyout drawer for playback queue management.
- **Dialogs & Modals (`src/components/modals`)**:
  - `AppModalsContainer.tsx`: Central declarative container for all 28+ modal dialogs.
  - `PlaylistSelectModal.tsx`: Modal dialog for selecting a playlist when adding tracks.
- **Player & Core Views**: `WaveformCanvas.tsx`, `SpectrumVisualizer.tsx`, `VuMeterWidget.tsx`, `LyricsView.tsx`, `DesktopLyricsOverlay.tsx`, `MiniPlayerWidget.tsx`, `BigScreenView.tsx`.
- **Audiophile & DSP Modals**: `ParametricEqModal.tsx`, `AutoEqModal.tsx`, `DynamicsStudioModal.tsx`, `AnalogLoFiModal.tsx`, `TapeDeckWidget.tsx`, `VinylTurntable.tsx`, `SoundscapeModal.tsx`.
- **Stem Studio**: `CreateStemProjectModal.tsx`, `StemProjectStudioModal.tsx`, `StemProjectsLibraryView.tsx`.
- **Library & Metadata**: `CoverArtPickerModal.tsx`, `TagEditorModal.tsx`, `TrackBookmarksModal.tsx`, `TrackStatsModal.tsx`, `DuplicateFinderModal.tsx`, `FileRenamerModal.tsx`, `FacetsFilterPane.tsx`.
- **System & Integrations**: `AudioHealthCheckModal.tsx`, `AudioPathInspectorModal.tsx`, `DownloadHubModal.tsx`, `CommandPaletteModal.tsx`, `KeyboardShortcutsModal.tsx`, `LanguageSelector.tsx`.

### Internationalization (`src/i18n.ts`)
Fully localized with complete string mappings for:
- 🇬🇧 English (`en`)
- 🇵🇱 Polish (`pl`)
- 🇩🇪 German (`de`)
- 🇫🇮 Finnish (`fi`)
- 🏛️ Latin (`la`)

---

## 6. Core Engineering Invariants & Safety Rules

When writing or refactoring code in Aura-Lune, agents **must strictly adhere** to the following rules:

1. **Audio Thread Real-Time Safety**:
   - The audio callback thread in `audio-engine` and `dsp-*` **must never perform heap allocations (`Vec::new()`, `Box::new()`, `String`), file I/O, network requests, or mutex locks**.
   - Use lock-free atomics, pre-allocated ring buffers, or crossbeam channels to communicate between GUI/worker threads and the audio processing thread.
2. **Early Returns Policy**:
   - Favor guard clauses and early returns (`if !valid { return Err(...); }` or `if (!isOpen) return null;`) over deeply nested conditional blocks.
3. **Zero Python Dependencies**:
   - The test infrastructure and build pipeline must strictly remain native Rust (`cargo test`) and TypeScript (`vitest run`). Do not introduce Python scripts or test harnesses.
4. **IPC Parity & Type Safety**:
   - When modifying a Tauri command in `commands/`, verify that both the backend handler and the corresponding frontend `invoke()` calls match signatures.
5. **Clean Imports**:
   - Do not leave unused imports or dead variables. Run `cargo check` and `npm --prefix apps/desktop run build` (`tsc -b`) to ensure clean compilation.

---

## 7. Testing & Verification Protocols

Always run the unified 4-stage test runner before and after making changes:

```bash
./tests/run_all_tests.sh
```

### Stage Breakdown:
1. **Environment Check**: Confirms active Node.js (>=18), Rust toolchain, GStreamer, and PipeWire libraries.
2. **Vitest Frontend Suite**:
   ```bash
   npm --prefix apps/desktop test
   ```
   Runs 12 test files covering utilities, i18n, and custom hooks.
3. **Cargo Rust Workspace Suite**:
   ```bash
   cargo test --workspace
   ```
   Runs unit and integration tests across all 12 workspace crates.
4. **Desktop Smoke Integration Test**:
   ```bash
   cargo test --package auralune-desktop --test desktop_smoke_test
   ```
   Verifies that the audio engine boots, storage migrations execute, and desktop commands respond correctly.
5. **Frontend Build Check**:
   ```bash
   npm --prefix apps/desktop run build
   ```
   Executes `tsc -b && vite build` to guarantee zero TypeScript type errors.

---

## 8. Agent Operational Recipes

### How to Add a New Tauri Command
1. Add the domain logic inside the appropriate module under `apps/desktop/src-tauri/src/commands/` (e.g. `commands/dsp.rs`).
2. Add a `#[tauri::command]` entry in `apps/desktop/src-tauri/src/lib.rs` that delegates to your `commands::*` function with a guard clause.
3. Register the command name in the `tauri::generate_handler![...]` macro list in `lib.rs`.
4. Call `invoke('command_name', { ... })` in the frontend hook or component.
5. Run `./tests/run_all_tests.sh` to verify.

### How to Add a New Modal Dialog
1. Add the modal identifier to `ModalId` in [`apps/desktop/src/hooks/useModalManager.ts`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src/hooks/useModalManager.ts).
2. Create your modal component under `apps/desktop/src/components/MyNewModal.tsx`.
3. In `App.tsx`, wire the modal visibility to `modalManager.isOpen('my_modal')` and pass `onClose={modalManager.close}`.
4. Open the modal anywhere via `modalManager.open('my_modal', optionalPayload)`.

---
*Maintained by Das Letzte Kemonomimi & Aura-Lune Core Engineering Agents.*
