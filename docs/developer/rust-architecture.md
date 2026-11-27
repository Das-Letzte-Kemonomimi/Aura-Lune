# Rust Architecture — core crates

Reference for the Cargo workspace crates under `crates/`. Rules agents must follow live in [`crates/AGENTS.md`](../../crates/AGENTS.md); this file is the detailed map.

## `crates/domain`
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
  - `silence`: `SilenceTrimmingConfig`, `find_silence_bounds` (RMS windows → `SilenceBounds`), `SilenceScanner` (same algorithm fed chunk by chunk — constant memory; `find_silence_bounds` delegates to it), `trim_action` (seek past lead / finish at trail).
  - `paths`: security rules for UI-supplied paths — `check_write_target` (also refuses the library DB `auralune_library.db*`, even inside app dirs), `has_allowed_extension`, `is_safe_file_token`, `AUDIO_EXTENSIONS`.
  - `renamer`: Pattern formatting (`%artist% - %title%`) and path sanitization.
  - `cue`: CUE sheet parser and track splitter.
  - `transcode`: Format choices (`Opus`, `Flac`, `Wav`) and `TimeRange` clipping validation.
  - `version`: semver comparison (`Version::parse`, `is_newer`) — prerelease `1.1.6-dev` < `1.1.6`; used by the updater.
- **Tests**: Located in `crates/domain/tests/`:
  - `dsp_models_test.rs`: EQ, parametric EQ, compressor, saturator, crossfeed, silence trimming.
  - `stem_and_library_models_test.rs`: Stem volume mappings, renamer, theme validation, bluetooth codecs.
  - `cue_and_m3u_parsers_test.rs`: CUE pregap calculation and M3U/M3U8 roundtrip export.
  - `version_test.rs`: semver ordering and malformed version rejection.

## `crates/dsp-api`
- **Purpose**: DSP abstraction layer defining unified traits implemented by DSP backends.
- **Key Items**:
  - `DspEngine`: Common interface for pitch, tempo, and rate manipulation. `as_str()` / `from_name()` (case-insensitive, unknown → `Bypass`) are the only string mapping — never match engine names by hand.
  - `DspCapabilities`: Formant preservation capabilities and pitch/tempo bounds.
  - Math helpers: `semitones_to_pitch_ratio()`, `pitch_ratio_to_semitones()`, `cents_to_semitones()`.
- **Tests**: Located in `crates/dsp-api/tests/dsp_api_test.rs`.

## `crates/dsp-rubberband` & `crates/dsp-soundtouch`
- **Purpose**: Native implementations of `DspEngine`.
- **`dsp-rubberband`**: High-fidelity time-stretching and pitch-shifting preserving formants using `librubberband`. Ideal for active listening.
- **`dsp-soundtouch`**: Low-latency, CPU-efficient time-stretching using `libsoundtouch`. Ideal for real-time scrub and DJing.

## `crates/audio-engine`
- **Purpose**: Core real-time playback engine powered by GStreamer 0.25 (`gst-plugins-base`, `gst-plugins-good`).
- **Key Modules & Features**:
  - `pipeline/`: `AudioEngine` orchestrator, split into thematic `impl AudioEngine` blocks (no file > ~450 lines):
    - `mod.rs` — shared state (`PipelineInner`, `StemMixerHandles`), `PlayerEvent`, lock-order rule (`inner` may be held while taking `queue`, never the reverse).
    - `graph.rs` — `AudioEngine::new()`: element creation and linking (`freeverb` starts unlinked/locked in `Null` when disabled; post-`queue_sink` `volume` placement for < 15 ms volume latency).
    - `probes.rs` — saturator and stereo widener pad probes (streaming-thread code; config in `AtomicCell`, channel count cached from Caps).
    - `source.rs` — `load_uri`, stems and stem projects (`teardown_source_unlocked`, `add_stem_mixer`, `add_stem_branch`), holding `source_lock` instead of `inner` across GStreamer `Null` transitions.
    - `transport.rs` — play/pause/stop/seek (`seek_with_fade`), position math (`seek` releases `inner` across `seek_simple`).
    - `fades.rs` — `atomic_volume`, `set_volume_smooth` S-curve, equal-power fades, crossfade, `fade_generation` cancellation.
    - `queue_ops.rs` — queue mutations and track switches (`switch_context`, `fade_out_before_switch`, `start_switched_track`).
    - `bus.rs` — `poll_events` (EOS → stop-after-current / `replay_current` / `advance_after_eos`, errors, tags, spectrum, pre-EOS fade). Called only by the desktop playback ticker.
    - `dsp.rs` (entering DSP from Bypass rebases the timeline instead of seeking; other engine switches still seek to realign PTS; `set_reverb_params` links/unlinks `freeverb` dynamically via an `IDLE` pad probe outside streaming/inner locks), `equalizer.rs`, `effects.rs` — DSP params, graphic/parametric EQ, dynamics, ReplayGain, crossfeed, silence config, widener, limiter.
  - `dsp_node.rs`: Custom `auralune_dsp` element switching Bypass / RubberBand / SoundTouch. **Real-time model:** bypass is lock-free (atomic engine flag, bit-perfect passthrough); processing holds the state lock only for one buffer; only the active engine (`RubberBand` or `SoundTouch`, neither in `Bypass`) is prepared for new formats/block sizes and swapped in outside the lock; output blocks are collected on the stack (no per-buffer heap allocation); format comes from the Caps event only.
  - `rt.rs`: Streaming-thread helpers — alignment-checked `f32` views of buffer bytes (`f32_samples`, `map_f32_samples_in_place`, `map_stereo_frames_in_place`, `extend_f32_samples`) with copy fallback, and `RateLimiter` for hot-path logging. Never cast buffer bytes with `slice::from_raw_parts`.
  - `spectrum.rs`: Pure spectrum math (dB normalisation, 64 → 16 perceptual bands, stereo assembly).
  - `analysis/`: `mod.rs` (Camelot/Krumhansl tables, `TrackKeyBpm`), `decode.rs` (`DecodeSession` — the only appsink decoder: timed pulls, bus error check, `Null` on drop; `decode_snippet_for_analysis` — timeout `max(6 s, max/10)`, partial result logs a warning; `decode_complete_for_analysis` — timeout after partial audio is an error, used for cached chord analysis; `decode_stereo_for_stems`), `key_bpm.rs` (incl. `read_bpm_tag`), `chroma.rs` (windowed FFT → spectral peaks with parabolic interpolation, global tuning estimate, log compression, bass/harmonic attenuation; per-beat **median** chroma), `beat_grid.rs` (`f64` beat period, onset-histogram phase, downbeat pick, per-bar phase snapping), `chords.rs` (templates with `prior`, cosine emissions → softmax, log-domain Viterbi with normalised transitions, segments split per bar, `CHORD_ANALYZER_VERSION`, `parse_chord_symbol`; tunables are named `const`s), `transcription.rs` (onsets computed in `f64` from the fractional frame hop — never truncate it to whole ms; `TRANSCRIPTION_ANALYZER_VERSION` is bumped whenever the algorithm changes), `replaygain.rs`, `waveform.rs` (streaming `WaveformAccumulator`, 256-sample blocks — never buffer a whole track), `silence.rs`.
  - `metadata_editor.rs`: Full tag reading and writing using `lofty`.
  - `model_manager.rs`: AI model catalog and SHA-256 verification.
  - `device.rs`: `DeviceManager` with PipeWire/ALSA card parsing.
  - `hpss.rs`: Harmonic-Percussive Source Separation. One pass over a 15-frame STFT ring buffer (`2·R_TIME+1`); each frame is masked and overlap-added immediately, so memory beyond the output signals is constant. `src/hpss_test.rs` keeps the original full-matrix implementation as a reference and asserts bit-identical output.
  - `sync.rs`: `LockExt::lock_safe()` — recovers poisoned mutexes; use it instead of `lock().unwrap()` in engine code.
  - `error.rs`: `AudioEngineError` (incl. `Validation`, `Pipeline`, `NotFound`, `External`), `AnalysisError`, `TagError`.
  - `uri.rs`: Single source of truth for path → GStreamer URI conversion (`media_uri`, `media_uri_checked`, `local_path`) with percent-encoding of spaces/non-ASCII and no double encoding. Never build `file://` URIs with `format!`.
- **Tests**: Comprehensive integration suites under `crates/audio-engine/tests/` (`playback_test.rs`, `flac_slow_test.rs`, `metadata_editor_test.rs`, `device_and_model_manager_test.rs`, etc.).

## `crates/storage` (Modular Architecture)
- **Purpose**: SQLite persistence layer built with `sqlx`, partitioned into 9 domain submodules:
  - [`src/models.rs`](../../crates/storage/src/models.rs): Database records (`TrackRecord`, `AlbumRecord`, `ArtistRecord`, `DspPresetRecord`, `DuplicateGroup`, `RecapSummaryDto`) and `StorageError`.
  - [`src/schema.rs`](../../crates/storage/src/schema.rs): Table DDL, indices, performance PRAGMAs (`cache_size = -64000`, `temp_store = MEMORY`, `mmap_size = 256MB` — set per connection in `Database::with_performance_pragmas`, never on the pool), versioned migrations (each step one transaction; v1 = stats/analysis columns + their indexes) (`PRAGMA user_version`, currently **v3**: v2 = bookmark `ON DELETE CASCADE`, `album_artist` repair, cached chord/transcription `bpm`/`musical_key`/`camelot`; v3 = `track_silence_bounds` cache), default anime themes.
  - [`src/library.rs`](../../crates/storage/src/library.rs): Track, album, and artist CRUD, metadata updates, duplicate detection.
  - [`src/bookmarks.rs`](../../crates/storage/src/bookmarks.rs): Track bookmarks and multi-cue timestamp markers.
  - [`src/settings.rs`](../../crates/storage/src/settings.rs): Key-value app settings, DSP presets, custom theme storage.
  - [`src/playlists.rs`](../../crates/storage/src/playlists.rs): Playlists CRUD, track ordering, and playback queue persistence (`PlaybackQueue`).
  - [`src/stats.rs`](../../crates/storage/src/stats.rs): Favorites, ratings, playback history, Recap summaries, and smart playlist queries.
  - [`src/analysis.rs`](../../crates/storage/src/analysis.rs): Musical analysis cache (chords, beat grid, notes, waveform peaks) and AI model registry. `get_track_chords(track_id, analyzer_version)` ignores rows of any other version (stale cache = miss → recompute); `save_track_chords` keeps exactly one row per track; `save_chord_overrides` updates the newest row only. `get_track_transcription(track_id, analyzer_version)` / `save_track_transcription` follow the same rule (stale version = miss, one row per track).
  - [`src/stems.rs`](../../crates/storage/src/stems.rs): Stem tracks and multitrack project storage.
  - [`src/lib.rs`](../../crates/storage/src/lib.rs): Slim facade exposing `Database`.
- **Tests**: Fully separated in `crates/storage/tests/` (`database_crud_test.rs`, `bookmarks_and_cues_test.rs`, `settings_and_dsp_presets_test.rs`, `waveforms_and_transcription_test.rs`, `stem_projects_multitrack_test.rs`, `smart_playlists_and_stats_test.rs`, `playlist_and_queue_persistence_test.rs`, `schema_migrations_test.rs`).

## `crates/library`
- **Purpose**: High-speed local music indexing using `walkdir` and `lofty`. Incremental scanning skips unchanged files using mtime and file size checks.
- **Album grouping**: albums are keyed by the `ALBUMARTIST` tag (falling back to the track artist), so compilations stay a single album.
- **Threading**: the directory walk (`walk_audio_files`) and tag/cover reading (`read_track_file`) run in `spawn_blocking`; only database writes stay async. Files whose metadata cannot be read still count as present for stale cleanup.
- **Stale cleanup**: after a complete walk of an existing root, `Database::delete_stale_tracks(root, active_paths)` removes records for files that vanished — scoped to that root only and skipped on walk errors (unmounted drives never wipe the library).
- **Tests**: `crates/library/tests/scanner_test.rs`.

## `crates/metadata`
- **Purpose**: External online metadata enrichment and social scrobbling.
- **Clients**: `AcoustidClient`, `CoverArtArchiveClient`, `LastFmClient`, `ListenBrainzClient`, `lyrics`, `urlencoding`.
- **HTTP rules (`http.rs`)**: build clients with `http::build_client(timeout)` (single `USER_AGENT` with version + repo URL); send API calls through `http::send_with_retry` (3 attempts, backoff, `Retry-After` ≤ 5 s, retries only network errors and 429/502/503/504); per-service `RateLimiter` (MusicBrainz 1/s, AcoustID 3/s). `fpcalc` runs with `FPCALC_TIMEOUT` (60 s) and `kill_on_drop`. `build_client` refuses redirects from a public host to `localhost`/private IPs; URLs chosen by the UI (e.g. `apply_cover_url`) must pass `net_guard::ensure_public_https_url` (https only, every resolved IP public). Cover bodies are streamed with the `MAX_COVER_BYTES` cap.
- **Tests**: Located in `crates/metadata/tests/` (`acoustid_fingerprint_test.rs`, `scrobbler_test.rs`, `lyrics_parser_test.rs`, `cover_art_archive_test.rs`).

## `crates/downloads`
- **Purpose**: Managed asynchronous HTTP asset downloads (AI separation models) with progress reporting, path traversal protection, and SHA-256 verification.
- **Paths**: destinations are checked by `domain::paths::check_write_target` (absolute, no `..`, no system dirs, no hidden `$HOME` entries except the app data/cache dirs). A `TempFileGuard` removes `.auralune_tmp_<pid>_<seq>_*` on every failed download. File I/O is `tokio::fs`; cancellation is polled every 500 ms even when the server sends nothing, and a download with no data for 120 s fails. Job IDs and temp names use a process-wide sequence (never time alone).
- **Tests**: Located in `crates/downloads/tests/download_manager_test.rs`.

## `crates/desktop-integration`
- **Purpose**: Linux desktop integration:
  - **MPRIS v2 D-Bus Interface**: Native system media keys, lock screen integration. Handlers run engine calls through `spawn_blocking` (transport methods sleep for micro-fades and must not block the Tokio D-Bus executor); the control socket does the same.
  - **Discord Rich Presence**: Live playback status, elapsed time, album art.
  - **Waybar Custom Module**: Real-time JSON status file `$XDG_RUNTIME_DIR/auralune/auralune.json`.
  - **Runtime dir (`runtime_dir.rs`)**: every IPC file (Waybar status, control FIFO `ctl`, socket `auralune.sock`) lives in `$XDG_RUNTIME_DIR/auralune/` (fallback `/tmp/auralune-<uid>/`), created `0700` and verified (owner, not a symlink) by `ensure_runtime_dir`. Never put IPC files directly in shared `/tmp`. Discord sockets in `/tmp` are used only when owned by the current uid.
  - **Control IPC**: `stop()` wakes the FIFO and socket listeners; commands are limited to 256 bytes and 8 concurrent socket connections. MPRIS `OpenUri` accepts only http(s) streams and existing local audio files.
  - **Desktop Icon Updater**: Switches system and window icons dynamically.
- **Tests**: Located in `crates/desktop-integration/tests/desktop_integration_test.rs`.

## Adding database columns or tables

1. Define the table DDL or new column in `crates/storage/src/schema.rs`.
2. Add a versioned migration step in `schema.rs` bumping `PRAGMA user_version` (never run raw unversioned `ALTER TABLE` in `init_db()`).
3. Add the struct fields and serialization in `crates/storage/src/models.rs`.
4. Implement the query methods in the respective domain submodule (`library.rs`, `playlists.rs`, etc.).
5. Add test coverage in `crates/storage/tests/`.

