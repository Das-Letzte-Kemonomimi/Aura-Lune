# Testing

Where tests live and how CI verifies the workspace.

All tests across the workspace are decoupled from production source files into dedicated integration test files under each crate's `tests/` directory:

| Crate | Test Files | Description |
|---|---|---|
| `crates/storage` | `tests/database_crud_test.rs`<br>`tests/bookmarks_and_cues_test.rs`<br>`tests/settings_and_dsp_presets_test.rs`<br>`tests/waveforms_and_transcription_test.rs`<br>`tests/stem_projects_multitrack_test.rs`<br>`tests/smart_playlists_and_stats_test.rs`<br>`tests/playlist_and_queue_persistence_test.rs`<br>`tests/schema_migrations_test.rs` (incl. silence cache) | Full SQLite persistence and query test suite |
| `crates/domain` | `tests/dsp_models_test.rs`<br>`tests/stem_and_library_models_test.rs`<br>`tests/cue_and_m3u_parsers_test.rs`<br>`tests/queue_test.rs`<br>`tests/silence_trim_test.rs`<br>`tests/version_test.rs` | Domain entities, parsers, DSP model math, and semver comparison |
| `crates/audio-engine` | `tests/playback_test.rs`<br>`tests/flac_slow_test.rs`<br>`tests/opus_and_transcode_test.rs`<br>`tests/metadata_editor_test.rs`<br>`tests/device_and_model_manager_test.rs`<br>`tests/dsp_boundary_and_concurrency_test.rs`<br>`tests/uri_test.rs`<br>`tests/silence_detection_test.rs`<br>`tests/decode_and_waveform_test.rs`<br>`tests/dsp_node_test.rs`<br>`tests/rt_helpers_test.rs`<br>`tests/spectrum_test.rs`<br>`src/hpss_test.rs`<br>`src/sync_test.rs` | GStreamer playback, bit-perfect bypass & DSP output length/PTS, aligned/unaligned sample casts, spectrum pooling, lock-order deadlock regression, URI encoding, DSP switching, tag editing, FFT |
| `crates/metadata` | `tests/acoustid_fingerprint_test.rs`<br>`tests/scrobbler_test.rs`<br>`tests/lyrics_parser_test.rs`<br>`tests/cover_art_archive_test.rs`<br>`tests/http_retry_test.rs`<br>`tests/net_guard_test.rs` | Network services, retry/backoff and rate limiting (local test server), LRC parsing, AcoustID, SSRF guard |
| `crates/downloads` | `tests/download_manager_test.rs` | Model download jobs & path traversal checks |
| `crates/desktop-integration` | `tests/desktop_integration_test.rs`<br>`tests/discord_rpc_test.rs`<br>`tests/mpris_test.rs`<br>`tests/waybar_and_ipc_test.rs`<br>`tests/runtime_dir_test.rs` | MPRIS, Discord RPC, Waybar atomic status, private runtime dir |
| `crates/dsp-api` | `tests/dsp_api_test.rs` | DSP parameters, semitone & cent math |
| `crates/library` | `tests/scanner_test.rs` | Incremental scan, album-artist grouping, scoped stale-track cleanup |
| `src-tauri` | `tests/commands_dto_test.rs`<br>`tests/ipc_contract_test.rs`<br>`tests/command_error_test.rs`<br>`tests/playback_ticker_test.rs`<br>`tests/install_identity_test.rs`<br>`tests/queue_item_id_test.rs`<br>`tests/security_config_test.rs`<br>`tests/updates_test.rs` | DTO validation, `AppState` Send+Sync safety, frontend `invoke()` ↔ `generate_handler!` ↔ `commands.generated.ts` contract, `CommandError` JSON shape and code mapping, updater logic (asset choice, `SHA256SUMS`, channel comparison, throttle, install kinds) incl. local-server release checks |

## Verification protocol (7-stage CI parity)

```bash
./tests/run_all_tests.sh
```

### The 7 Stages Verified by `run_all_tests.sh`:
1. **Rust Formatting**: `cargo fmt --all --check`
2. **Frontend Linting & Vitest Suite**: `oxlint` + all Vitest test suites
3. **Frontend TypeScript & Vite Production Build**: `tsc -b && vite build`
4. **Rust Clippy**: `cargo clippy --workspace --all-targets --all-features -- -D warnings`
5. **Rust Workspace Tests**: `cargo test --workspace -- --test-threads=1`
6. **Desktop Smoke Integration Test**: `desktop_smoke_test`
7. **Shell Scripts Syntax Validation**: `bash -n` across all `.sh` scripts

### Useful Script Flags:
- `./tests/run_all_tests.sh --fix`: Automatically runs `cargo fmt` before checking.
- `./tests/run_all_tests.sh --fast`: Runs checks without long-running audio playback tests.
- `./tests/run_all_tests.sh --bundle`: Tests local AppImage bundling if dependencies are present.

