# Architecture Guide

High-level map of Aura-Lune. Start here, then follow the links in [`README.md`](README.md) for each layer.

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

## Repository layout

The repository follows the [tauri-template](https://github.com/dannysmith/tauri-template) layout (`src/` + `src-tauri/` at the root), extended with a Cargo workspace of core crates in `crates/`.

```
Aura-Lune/
├── src/                     # React 19 frontend (see src/AGENTS.md)
│   ├── api/                 # Typed IPC: ipc.ts, settings.ts, commands.generated.ts
│   ├── components/          # common/, layout/, library/, modals/, player/
│   ├── hooks/               # Domain hooks and prop-builder hooks
│   ├── state/               # livePlayback store, status commit rules
│   ├── views/               # Feature screens (player, library, dsp, playlists, stats, settings…)
│   ├── types/  utils/       # Backend contracts, DSP math, formatters
│   ├── locales/  i18n.ts    # en, pl, de, fi, la dictionaries
│   ├── data/changelog.json  # In-app changelog
│   └── test/                # Vitest setup and shared IPC mock
├── src-tauri/               # Tauri host crate `auralune-desktop` (see src-tauri/AGENTS.md)
│   ├── src/{lib.rs, main.rs, setup/, commands/, updater/}
│   ├── capabilities/  icons/  tauri.conf.json  build.rs
│   └── tests/               # Command DTO, IPC contract, security, updater, smoke tests
├── crates/                  # Core Rust crates (see crates/AGENTS.md)
│   ├── domain/  dsp-api/  dsp-rubberband/  dsp-soundtouch/
│   ├── audio-engine/  storage/  library/  metadata/
│   ├── downloads/  desktop-integration/  cli-spike/
├── public/                  # Static web assets (favicons, app icons)
├── scripts/                 # Node tooling (generate-command-names.mjs)
├── tests/                   # run_all_tests.sh (CI parity) + fixtures
├── packaging/               # AppImage, Arch (PKGBUILD*), release helper scripts
├── docs/                    # developer/ (this folder), adr/, RELEASING.md, architecture.md
├── skills/                  # Project agent skills (release, i18n-sync, …)
├── .github/                 # ci.yml, release-prepare.yml, release-publish.yml, setup-build-env action
├── index.html  vite.config.ts  tsconfig*.json  .oxlintrc.json  package.json
├── Cargo.toml  rust-toolchain.toml  deny.toml
└── AGENTS.md  CLAUDE.md  GEMINI.md  DEVELOPMENT.md  CHANGELOG*.md  install.sh
```
