# 🌸 Aura-Lune — Agents & Developer Architecture Guide

This document is the single source of truth for AI agents and human developers working on the **Aura-Lune** codebase. It details the complete architecture, crate responsibilities, frontend components, state hooks, testing protocols, and core engineering invariants.

---

## 📑 Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Repository Directory Structure](#2-repository-directory-structure)
3. [Rust Backend Crates (`crates/`)](#3-rust-backend-crates-crates)
4. [Tauri Desktop Backend (`apps/desktop/src-tauri`)](#4-tauri-desktop-backend-appsdesktopsrc-tauri)
5. [Frontend Architecture (`apps/desktop/src`)](#5-frontend-architecture-appsdesktopsrc)
   - [Views & Screens (`src/views`)](#views--screens-srcviews)
   - [Domain Hooks (`src/hooks`)](#domain-hooks-srchooks)
   - [Prop Builder Hooks](#prop-builder-hooks)
   - [UI Components (`src/components`)](#ui-components-srccomponents)
   - [Type Definitions (`src/types`)](#type-definitions-srctypes)
   - [Audio & DSP Utilities (`src/utils`)](#audio--dsp-utilities-srcutils)
   - [Internationalization (`src/locales` & `src/i18n.ts`)](#internationalization-srclocales--srci18nts)
6. [Core Engineering Invariants & Safety Rules](#6-core-engineering-invariants--safety-rules)
7. [Mandatory Code Quality, Linting & Verification Protocol](#7-mandatory-code-quality-linting--verification-protocol)
8. [Agent Operational Recipes](#8-agent-operational-recipes)

---

## 1. High-Level Architecture

Aura-Lune is a Linux-first, Poweramp & foobar2000-inspired music player built with anime aesthetics, audiophile-grade DSP, and real-time stem separation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   React 19 + TypeScript + Vite Frontend                │
│ (Feature Views, Modals Container, Virtualized Queue, Audio Simulators) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC (Tauri v2 invoke / events)
┌───────────────────────────────────▼────────────────────────────────────┐
│              Tauri v2 Native Host (auralune-desktop)                   │
│   commands/ (playback, dsp, library, stems, metadata, devices, queue,  │
│              playlists, themes, bookmarks, renamer, downloads)         │
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
- **IPC Layer**: Tauri 2.0 with type-safe commands organized modularly under `apps/desktop/src-tauri/src/commands/`.
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
│       │   ├── components/          # Modular component ecosystem
│       │   │   ├── common/          # Shared atomic widgets (LanguageSelector)
│       │   │   ├── layout/          # AppHeader, BottomPlaybackDock, MainContentRouter, etc.
│       │   │   ├── library/         # Library subcomponents (FacetsFilterPane)
│       │   │   ├── modals/          # 32 specialized modal dialogs & AppModalsContainer
│       │   │   └── player/          # Turntable, TapeDeck, VuMeter, Spectrum, Waveform, Lyrics
│       │   ├── hooks/               # 20+ specialized domain & controller hooks
│       │   ├── locales/             # Extracted JSON translation dictionaries (en, pl, de, fi, la)
│       │   ├── types/               # TypeScript domain contracts (queue, theme, equalizer, etc.)
│       │   ├── utils/               # DSP math, AutoEQ database, Romaji, harmonic mixing
│       │   ├── views/               # Domain feature screens
│       │   │   ├── changelog/       # ChangelogView
│       │   │   ├── dsp/             # DspStudioView
│       │   │   ├── library/         # LibraryView
│       │   │   ├── player/          # PlayerView, BigScreenView
│       │   │   ├── playlists/       # PlaylistsView, RadioView
│       │   │   ├── settings/        # AppSettingsModal, Audio, Themes, Backup, Transcode, About
│       │   │   ├── stats/           # StatsDashboardView
│       │   │   └── stems/           # StemProjectsLibraryView
│       │   ├── App.tsx              # Slim, declarative application shell
│       │   ├── i18n.ts              # Translation loader & helper functions
│       │   └── main.tsx             # React DOM root entrypoint
│       └── src-tauri/               # Tauri Rust Backend (crate: auralune-desktop)
│           ├── src/
│           │   ├── commands/        # Fully modularized Tauri command handlers
│           │   │   ├── mod.rs       # Module exports
│           │   │   ├── bookmarks.rs # Track A-B repeat bookmarks & cues
│           │   │   ├── devices.rs   # Audio cards, Bluetooth codecs, Discord RPC
│           │   │   ├── downloads.rs # Asynchronous file and model downloads
│           │   │   ├── dsp.rs       # Pitch, tempo, rate, EQ bands, AutoEQ, dynamics
│           │   │   ├── library.rs   # Scanner, tracks, albums, artists, favorites, stats
│           │   │   ├── metadata.rs  # AcoustID, Cover Art Archive, Last.fm, ListenBrainz
│           │   │   ├── playback.rs  # Play, pause, stop, seek, MPRIS sync
│           │   │   ├── playlists.rs # Playlist CRUD, smart playlists, M3U8, Radio streams
│           │   │   ├── queue.rs     # Queue management, shuffling, loop modes, reordering
│           │   │   ├── renamer.rs   # File renamer pattern preview & execution
│           │   │   ├── stems.rs     # AI separation, stem mixer, stem projects
│           │   │   └── themes.rs    # Themes CRUD, wallpaper uploads, system desktop icons
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
  - App settings (language, active theme, Discord client ID, icon style).

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
All command implementations are organized into `src/commands/`:

| Module | Responsibility | Key Commands / Functions |
|---|---|---|
| [`playback.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/playback.rs) | Playback controls & MPRIS sync | `play`, `pause`, `stop`, `seek`, `sync_mpris_from_queue_item`, `sync_desktop_playback_state` |
| [`queue.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/queue.rs) | Queue lifecycle, looping, shuffling | `get_queue`, `set_queue`, `add_to_queue`, `add_uris_to_queue`, `add_next_to_queue`, `remove_from_queue`, `reorder_queue`, `clear_queue`, `play_queue_index`, `play_next`, `play_previous`, `set_loop_mode`, `toggle_shuffle`, `set_stop_after_current`, `toggle_stop_after_current`, `notify_track_looped` |
| [`dsp.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/dsp.rs) | Pitch, tempo, rate, EQ & AutoEQ, dynamics | `set_pitch`, `set_tempo`, `set_rate`, `set_equalizer_bands`, `set_equalizer_enabled`, `set_parametric_eq_enabled`, `set_compressor_enabled`, `set_saturator_enabled`, `set_limiter_enabled`, `set_crossfeed_enabled`, `set_silence_trimming_enabled`, `set_replaygain_mode` |
| [`library.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/library.rs) | Local library scanning, queries & stats | `scan_paths`, `rescan_library`, `get_library_stats`, `get_library_tracks`, `get_library_albums`, `get_library_artists`, `get_favorite_tracks`, `get_recently_played_tracks`, `get_top_played_tracks`, `get_hires_tracks`, `toggle_favorite`, `set_track_rating`, `find_duplicate_tracks`, `delete_track_record` |
| [`playlists.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/playlists.rs) | Playlists, Smart Playlists, Radio & CUE | `create_playlist`, `delete_playlist`, `list_playlists`, `add_track_to_playlist`, `remove_track_from_playlist`, `get_playlist_tracks`, `save_queue_as_playlist`, `list_smart_playlist_tracks`, `export_playlist_m3u8`, `import_playlist_m3u8`, `load_radio_stream`, `parse_cue_sheet_content` |
| [`themes.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/themes.rs) | Themes, wallpapers & system icons | `list_themes`, `get_active_theme`, `set_active_theme`, `save_theme`, `update_theme_background`, `export_theme_json`, `import_theme_json`, `upload_background_image`, `set_app_icon_style`, `get_app_icon_style`, `update_system_icons` |
| [`bookmarks.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/bookmarks.rs) | Track timestamps & A-B repeat bookmarks | `save_bookmark`, `get_bookmark`, `delete_bookmark`, `get_track_bookmarks`, `add_track_bookmark`, `update_track_bookmark`, `delete_track_bookmark` |
| [`metadata.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/metadata.rs) | Tags, MusicBrainz, Covers, Scrobbling | `get_track_metadata`, `update_track_metadata`, `search_musicbrainz_releases`, `fetch_and_apply_cover`, `search_cover_candidates`, `apply_cover_url`, `apply_custom_cover_file`, `get_track_cover`, `get_lyrics`, `validate_listenbrainz_token`, `lastfm_scrobble` |
| [`devices.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/devices.rs) | Audio devices, Bluetooth codecs, Volume | `list_devices`, `set_audio_device`, `get_bluetooth_codecs`, `set_bluetooth_codec`, `get_master_volume`, `set_master_volume`, `set_volume_unit`, `get_discord_rpc_status`, `set_discord_rpc_enabled` |
| [`stems.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/stems.rs) | AI models & Stem Project Studio | `start_stem_separation`, `get_track_stems`, `load_track_stems`, `set_stem_mixer_state`, `create_stem_project`, `list_stem_projects`, `get_stem_project`, `delete_stem_project`, `export_stem_project_zip` |
| [`renamer.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/renamer.rs) | Pattern-based audio file renamer | `preview_rename_tracks`, `execute_rename_tracks` |
| [`downloads.rs`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/src/commands/downloads.rs) | Managed async asset & model downloads | `add_download_job`, `cancel_download_job`, `list_download_jobs` |

---

## 5. Frontend Architecture (`apps/desktop/src`)

### Views & Screens (`src/views`)
Each major application feature lives in its own dedicated directory and is re-exported via `src/views/index.ts`:
- **`views/player/`**:
  - `PlayerView.tsx`: Main playback screen with spinning vinyl, cassette tape, interactive waveform canvas, spectrum visualizer, and dual VU meters.
  - `BigScreenView.tsx`: Cinematic full-screen player with large album art, retro turntable, and synched lyrics.
- **`views/library/`**:
  - `LibraryView.tsx`: Virtualized library view (tracks, albums, artists, genres, hires indicator, instant search).
- **`views/dsp/`**:
  - `DspStudioView.tsx`: Audiophile DSP rack (10-band graphic EQ, Parametric EQ, RubberBand/SoundTouch pitch/tempo, Dynamics studio, Crossfeed, ReplayGain).
- **`views/playlists/`**:
  - `PlaylistsView.tsx`: Custom user playlists with M3U8 export/import and smart playlists.
  - `RadioView.tsx`: Live anime, J-Pop, and Lo-Fi internet radio streaming stations.
- **`views/stems/`**:
  - `StemProjectsLibraryView.tsx`: Stem project manager and multi-track separation hub.
- **`views/stats/`**:
  - `StatsDashboardView.tsx`: Listening recap, top artists, play counts, and analytics.
- **`views/changelog/`**:
  - `ChangelogView.tsx`: Interactive, multi-lingual version history and release notes.
- **`views/settings/`**:
  - `AppSettingsModal.tsx`: Tabbed settings container.
  - `AudioDevicesSettingsView.tsx`: Audio cards, buffer size, DSP block size, and volume OSD position.
  - `ThemesSettingsView.tsx`: Theme browser, background custom image/video picker, blur, and opacity.
  - `BackupSettingsView.tsx`: Profile export/import, Last.fm, ListenBrainz, and Discord RPC settings.
  - `TranscodeSettingsView.tsx`: Format conversion tool (Opus/FLAC/WAV/MP3) with A-B bookmark export.
  - `AboutSettingsView.tsx`: Version info, licensing, audio system health check.

---

### Domain Hooks (`src/hooks`)
All stateful logic is cleanly decoupled from presentation into tested domain hooks:
- **`useAudioPlayer`**: Controls volume, playback state, position tracking, and DSP pitch/tempo parameters.
- **`usePlaybackController`**: Coordinates higher-level play, pause, next, previous, stop, seek, and loop operations.
- **`usePlaybackQueue`**: Queue management, reordering, shuffling, removing, and virtualized queue tracking.
- **`useLibraryManager`**: Handles library scanning, indexing progress, track loading, and album/artist queries.
- **`useLibraryPlaybackActions`**: Handles favorites, track ratings, play count resetting, and adding tracks to playlists.
- **`useDspManager`**: DSP engine selection, 10-band graphic EQ, parametric EQ, compressor, saturator, and limiter.
- **`useThemeEngine` & `useThemeManager`**: Theme tokens, custom wallpaper uploads, overlay opacity, and blur radius.
- **`useModalManager`**: Central modal router supporting typed `open()`, `close()`, `isOpen()`, and `Escape` key handling.
- **`useAudioSettings`**: Audio device selection, buffer sizes, bit-perfect toggle, and volume OSD configurations.
- **`usePlaylistManager`**: Playlist CRUD, M3U8 import/export, and radio stations.
- **`useTranscodeManager`**: Audio conversion jobs, background progress tracking, and range exports.
- **`useMusicBrainzManager`**: MusicBrainz release queries, cover art fetching, and manual cover uploads.
- **`useScrobblerManager`**: Last.fm and ListenBrainz session authentication and scrobble dispatch.
- **`useSessionManager`**: App session bootstrap, audio health check, and system diagnostic reporting.
- **`useAmbienceMode`**: Ambient anime particle visualizers (Sakura, Neon Rain, Fireflies, Snow, Matrix Rain, Momiji, Embers).
- **`useVolumeUnit`**: Toggle volume display between percent (`%`) and decibels (`dBFS`).
- **`useInfinityQueue`**: Auto-recommendation queue continuation based on genre and artist similarity.
- **`useHotkeysManager`**: Global keyboard shortcuts coordinator with text-input guard.
- **`useVirtualScroll` & `useQueueVirtualScroll`**: Windowed rendering for ultra-large track libraries.

---

### Prop Builder Hooks
To keep UI shells concise and declarative:
- **`useAppHeaderProps`**: Assembles props for `AppHeader` from domain hooks.
- **`useBottomPlaybackDockProps`**: Assembles props for `BottomPlaybackDock`.
- **`useMainContentRouterProps`**: Assembles view routing parameters for `MainContentRouter`.
- **`useMainRouterProps`**: Bundles all child view props (`playerProps`, `libraryProps`, `dspProps`, `playlistsProps`).
- **`useAppModalsProps`**: Bundles props required by the 32 modals in `AppModalsContainer`.
- **`useAppSettingsModalProps`**: Bundles settings tabs into `AppSettingsModal`.

---

### UI Components (`src/components`)
Organized by functional subfolder and exported via barrel `index.ts` files:
- **`components/layout/`**:
  - `AppHeader.tsx`, `AppNavbar.tsx`, `BottomPlaybackDock.tsx`, `MainContentRouter.tsx`
  - `BackgroundLayer.tsx`, `BackgroundExportBadge.tsx`, `DragDropOverlay.tsx`, `QueueDrawer.tsx`
- **`components/player/`**:
  - `VinylTurntable.tsx`: Realistic grooved vinyl record with moving tonearm.
  - `TapeDeckWidget.tsx`: 90s vintage audio cassette with rotating spools and tape type selector.
  - `VuMeterWidget.tsx`: Analog dual needle ballistic VU meter.
  - `SpectrumVisualizer.tsx`: 64-band frequency spectrum visualizer with peak hold.
  - `WaveformCanvas.tsx`: High-resolution audio waveform canvas with seek scrubbing.
  - `PianoRollCanvas.tsx`: Interactive transcription MIDI piano roll canvas.
  - `ChordTimelineView.tsx`: Chord progression visualization and export.
  - `DesktopLyricsOverlay.tsx`: Floating desktop synchronized lyrics overlay.
  - `LyricsView.tsx`: Full-height karaoke-style scrolling lyrics with Romaji transliteration.
  - `MiniPlayerWidget.tsx`: Ultra-compact floating mini player widget.
  - `VolumeOsd.tsx`: On-screen volume display with position options.
  - `AnimeAmbienceFX.tsx`: Canvas particle ambience effects engine.
- **`components/modals/`**:
  - `AppModalsContainer.tsx`: Declarative container mounting all modal dialogs.
  - 32 modals: `ParametricEqModal`, `AutoEqModal`, `DynamicsStudioModal`, `AnalogLoFiModal`, `SoundscapeModal`, `HarmonicSuggesterModal`, `StemMixerModal`, `StemProjectStudioModal`, `CreateStemProjectModal`, `CoverArtPickerModal`, `TagEditorModal`, `FileRenamerModal`, `DuplicateFinderModal`, `TrackBookmarksModal`, `TrackStatsModal`, `CueSheetModal`, `DownloadHubModal`, `CommandPaletteModal`, `KeyboardShortcutsModal`, `AudioHealthCheckModal`, `AudioPathInspectorModal`, `OnboardingModal`, `KeyBpmModal`, `MusicAnalysisModal`, `AuraluneRecapModal`, `UrlAudioImportModal`, `SaveQueueModal`, `AddRadioStationModal`, `PlaylistSelectModal`, `SleepTimerModal`, `ModelManagerModal`, `LoopEditorModal`.
- **`components/library/`**:
  - `FacetsFilterPane.tsx`: Genre, artist, year, and format multi-facet filter pane.
- **`components/common/`**:
  - `LanguageSelector.tsx`: Dropdown for switching application language in real time.

---

### Type Definitions (`src/types`)
Shared TypeScript contracts live in `src/types/`:
- `queue.ts`: `QueueItem`, `PlaybackQueue`, `QueueColumnConfig`, `DEFAULT_QUEUE_COLUMNS`, `getQueueGridTemplate`.
- `playlist.ts`: `Playlist` (id, name, track_count, created_at, modified_at).
- `theme.ts`: `ThemeTokens`, `Theme`.
- `equalizer.ts`: `EqualizerPreset`, `EQUALIZER_BANDS`.
- `player.ts`: `PlaybackState`, `DspEngineType`, `PlaybackStatus`, `TrackRecord`, `AlbumRecord`, `DspPresetRecord`, `ReleaseCandidateDto`, `SampleTrackDto`.
- `analysis.ts`: `TrackKeyBpm`, `ChordSegment`, `AiModelInfo`.

---

### Audio & DSP Utilities (`src/utils`)
- `parametricEqMath.ts`: Computes biquad filter transfer functions, frequency response curves, and safe preamp adjustments.
- `autoEqDatabase.ts`: Curated database of AutoEQ profiles for hundreds of popular audiophile headphones.
- `harmonicMixing.ts`: Camelot wheel harmonic key matching and musical transposition algorithms.
- `vinylSimulator.ts`: Real-time vinyl record simulation (surface noise, dust crackles, 33/45 RPM wow & flutter).
- `soundscapeAudio.ts`: Procedural ambient soundscape generator (rain, thunder, cafe, waves, night ambient).
- `romaji.ts`: Transliterates Japanese Kanji, Hiragana, and Katakana titles into readable Latin Romaji.
- `timeFormat.ts`: Precise time formatting utilities (`formatTime`, `formatTimeMs`, `parseTimeToMs`).
- `fileSizeFormat.ts`: Formats bytes into human-readable strings (`formatBytes`).

---

### Internationalization (`src/locales` & `src/i18n.ts`)
Translations are completely extracted into standalone JSON files under `apps/desktop/src/locales/`:
- 🇬🇧 English (`en.json`)
- 🇵🇱 Polish (`pl.json`)
- 🇩🇪 German (`de.json`)
- 🇫🇮 Finnish (`fi.json`)
- 🏛️ Latin (`la.json`)

Helper functions in `src/i18n.ts` provide type-safe access to strings with automatic fallback to English.

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
4. **Toolchain Baseline**:
   - **Node.js**: Node.js 22 LTS (`.nvmrc` pinned to `22`) and npm >= 10.
   - **Rust**: Rust stable 1.80+ / 1.99+ (`rust-toolchain.toml` pinned to `stable` with `rustfmt` and `clippy` components).
5. **IPC Parity & Type Safety**:
   - When modifying a Tauri command in `commands/`, verify that both the backend handler and the corresponding frontend `invoke()` calls match signatures.

---

## 7. Mandatory Code Quality, Linting & Verification Protocol

> [!IMPORTANT]
> **MANDATORY AGENT COMPLETION PROTOCOL**
> Before completing ANY task and reporting to the user, the agent **MUST** run the code quality, linting, and verification commands below for both React and Rust. No task is considered complete until all checks pass with 0 errors and 0 warnings.

### A. React Frontend Quality & Linting
Run all three commands from the workspace root:
```bash
# 1. High-speed linting across all frontend files
npm --prefix apps/desktop run lint

# 2. Strict TypeScript type check and production bundling (must pass with 0 diagnostics)
npm --prefix apps/desktop run build

# 3. Unit test suite across hooks, components, and i18n parity (must be 100% green)
npm --prefix apps/desktop test -- --run
```

### B. Rust Backend Quality & Linting
Run all four commands from the workspace root:
```bash
# 1. Format all workspace crates to canonical style
cargo fmt --all

# 2. Strict Clippy lint check with all warnings treated as errors
cargo clippy --workspace --all-targets -- -D warnings

# 3. Compile check across all workspace crates
cargo check --workspace

# 4. Unit & integration test suite across all 11 crates
cargo test --workspace
```

### C. Unified End-to-End Test Suite
Run the 4-stage pipeline script to verify everything simultaneously:
```bash
./tests/run_all_tests.sh
```

#### The 4 Stages Verified by `run_all_tests.sh`:
1. **Frontend Unit & Localization Tests**: 39 Vitest suites (147+ tests) testing all domain hooks, state managers, and translations.
2. **Frontend TypeScript & Vite Production Build**: `tsc -b && vite build` ensuring production assets are bundled without error.
3. **Rust Workspace Test Suite**: Tests across `audio-engine`, `domain`, `storage`, `library`, `metadata`, `downloads`, `dsp-api`, `dsp-rubberband`, `dsp-soundtouch`, and `desktop-integration`.
4. **Desktop Smoke Integration Test**: Verifies GStreamer pipeline instantiation, SQLite migrations, and Tauri IPC commands end-to-end.

---

## 8. Agent Operational Recipes

### How to Add a New Tauri Command
1. Implement the command function in the relevant module under `apps/desktop/src-tauri/src/commands/` (e.g. `commands/queue.rs`).
2. Mark it `#[tauri::command]` and `pub fn` (or `pub async fn`).
3. Re-export it in `apps/desktop/src-tauri/src/commands/mod.rs` and `pub use commands::my_module::*;` in `lib.rs`.
4. Register the command name in the `tauri::generate_handler![...]` macro list in `lib.rs`.
5. Call `invoke('command_name', { ... })` in the frontend hook or component.
6. Run `cargo fmt --all` and `./tests/run_all_tests.sh` to verify.

### How to Add a New Modal Dialog
1. Add the modal identifier to `ModalId` in [`apps/desktop/src/hooks/useModalManager.ts`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src/hooks/useModalManager.ts).
2. Create your modal component under `apps/desktop/src/components/modals/MyNewModal.tsx`.
3. Export it in `apps/desktop/src/components/modals/index.ts`.
4. Register its rendering and visibility in [`AppModalsContainer.tsx`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src/components/modals/AppModalsContainer.tsx).
5. Open the modal anywhere via `modalManager.open('my_modal', optionalPayload)`.

---
*Maintained by Das Letzte Kemonomimi & Aura-Lune Core Engineering Agents.*
