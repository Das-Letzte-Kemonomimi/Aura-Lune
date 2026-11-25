# 🛠️ Aura-Lune — Development, Testing & Release Guide

This document provides complete instructions for setting up the development environment, running tests, and compiling production release artifacts for **Aura-Lune (Kitsune Music Player)** on Linux.

---

## 📑 Table of Contents

1. [System Prerequisites](#1-system-prerequisites)
   - [Ubuntu / Debian / Linux Mint / Pop!_OS](#ubuntu--debian--linux-mint--pop_os)
   - [Arch Linux / Manjaro / EndeavourOS](#arch-linux--manjaro--endeavouros)
   - [Fedora / RHEL](#fedora--rhel)
   - [openSUSE Tumbleweed](#opensuse-tumbleweed)
2. [Toolchain Setup](#2-toolchain-setup)
   - [Node.js & npm](#nodejs--npm)
   - [Rust Toolchain](#rust-toolchain)
3. [Repository Setup & Initialization](#3-repository-setup--initialization)
4. [Development Workflow](#4-development-workflow)
   - [Running Frontend in Browser Dev Mode](#running-frontend-in-browser-dev-mode)
   - [Running Full Desktop App in Dev Mode (Tauri)](#running-full-desktop-app-in-dev-mode-tauri)
5. [Code Quality & Linting](#5-code-quality--linting)
   - [Rust Code Formatting & Clippy](#rust-code-formatting--clippy)
   - [Frontend Linting (oxlint & TypeScript)](#frontend-linting-oxlint--typescript)
6. [Testing Protocols](#6-testing-protocols)
   - [Unified 4-Stage Test Runner](#unified-4-stage-test-runner)
   - [Frontend Unit Tests (Vitest)](#frontend-unit-tests-vitest)
   - [Rust Workspace Unit & Integration Tests](#rust-workspace-unit--integration-tests)
   - [Desktop Smoke Test](#desktop-smoke-test)
7. [Building for Release](#7-building-for-release)
   - [Standard Release Build (AppImage & .deb)](#standard-release-build-appimage--deb)
   - [Optimized Standalone Binary](#optimized-standalone-binary)
   - [Release Artifact Outputs](#release-artifact-outputs)
8. [Troubleshooting & FAQs](#8-troubleshooting--faqs)

---

## 1. System Prerequisites

Aura-Lune relies on modern Linux audio and GUI frameworks:
- **Audio**: GStreamer 1.0 (with `base`, `good`, `bad`, `ugly`, and `libav` plugins), PipeWire / ALSA.
- **DSP**: `librubberband` (high-fidelity formant-preserving stretch) and `libsoundtouch` (low-latency time/pitch).
- **GUI**: WebKit2GTK 4.1 (`libsoup-3.0`), GTK 3, and D-Bus (for MPRIS).
- **Database**: SQLite 3 (bundled/managed via `sqlx`).

Install the required system development headers for your distribution:

### Ubuntu / Debian / Linux Mint / Pop!_OS
```bash
sudo apt update
sudo apt install -y \
  build-essential \
  pkg-config \
  libssl-dev \
  libglib2.0-dev \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libgstreamer1.0-dev \
  libgstreamer-plugins-base1.0-dev \
  libgstreamer-plugins-good1.0-dev \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly \
  gstreamer1.0-libav \
  gstreamer1.0-pipewire \
  gstreamer1.0-alsa \
  librubberband-dev \
  libsoundtouch-dev \
  libasound2-dev
```

### Arch Linux / Manjaro / EndeavourOS
```bash
sudo pacman -Syu --needed \
  base-devel \
  pkgconf \
  openssl \
  glib2 \
  gtk3 \
  webkit2gtk-4.1 \
  libappindicator-gtk3 \
  librsvg \
  gstreamer \
  gst-plugins-base \
  gst-plugins-good \
  gst-plugins-bad \
  gst-plugins-ugly \
  gst-libav \
  gst-plugin-pipewire \
  rubberband \
  soundtouch \
  alsa-lib
```

### Fedora / RHEL
```bash
sudo dnf install -y \
  @development-tools \
  pkgconfig \
  openssl-devel \
  glib2-devel \
  gtk3-devel \
  webkit2gtk4.1-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  gstreamer1-devel \
  gstreamer1-plugins-base-devel \
  gstreamer1-plugins-good \
  gstreamer1-plugins-bad-free \
  gstreamer1-plugins-ugly-free \
  gstreamer1-libav \
  pipewire-gstreamer \
  rubberband-devel \
  soundtouch-devel \
  alsa-lib-devel
```

### openSUSE Tumbleweed
```bash
sudo zypper install -y \
  patterns-devel-base-devel_basis \
  pkg-config \
  libopenssl-devel \
  glib2-devel \
  gtk3-devel \
  webkit2gtk3-soup3-devel \
  libappindicator3-devel \
  librsvg-devel \
  gstreamer-devel \
  gstreamer-plugins-base-devel \
  gstreamer-plugins-good \
  gstreamer-plugins-bad \
  gstreamer-plugins-ugly \
  gstreamer-plugins-libav \
  rubberband-devel \
  libsoundtouch-devel \
  alsa-devel
```

---

## 2. Toolchain Setup

### Node.js & npm
Aura-Lune targets **Node.js 22 (Active LTS)** and **npm >= 10**. A `.nvmrc` file is provided in the repository root.

Check your installation:
```bash
node -v
npm -v
```

If you use [nvm](https://github.com/nvm-sh/nvm), load the configured version automatically:
```bash
nvm use
# or install it if not already present:
nvm install 22
```

### Rust Toolchain
Aura-Lune uses modern **Rust stable (1.80+ / 1.99+)**. A [`rust-toolchain.toml`](file:///home/kamu/Projects/Aura-Lune/rust-toolchain.toml) file is pinned at the repository root with `rustfmt` and `clippy` components enabled.

Check your installation:
```bash
rustc --version
cargo --version
```

If needed, install or update via `rustup`:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustup update stable
rustup component add rustfmt clippy
```

---

## 3. Repository Setup & Initialization

Clone the repository and install Node workspace dependencies:

```bash
git clone https://github.com/Auralune/Auralune.git
cd Auralune

# Install root & desktop frontend dependencies
npm install --prefix apps/desktop
```

Verify that the Rust workspace compiles:
```bash
cargo check --workspace
```

---

## 4. Development Workflow

### Running Frontend in Browser Dev Mode
You can develop UI components, layout, and theme styles in a regular browser window with hot-module reloading (HMR):

```bash
npm --prefix apps/desktop run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
*(Note: Native audio playback, GStreamer, and database features require the Tauri desktop shell).*

### Running Full Desktop App in Dev Mode (Tauri)
To launch the complete native desktop application with live frontend HMR and native Rust audio backend:

```bash
npm run tauri dev
```
*Or equivalently from the root directory:*
```bash
npm --prefix apps/desktop exec tauri dev
```

During development:
- Edits in `apps/desktop/src/**` automatically hot-reload in the desktop window.
- Edits in `apps/desktop/src-tauri/**` or `crates/**` automatically trigger a Rust recompile and app restart.

---

## 5. Code Quality & Linting

### Rust Code Formatting & Clippy
Always maintain strict formatting and clippy compliance:

```bash
# Format all crates in the workspace
cargo fmt --all

# Check formatting without modifying files
cargo fmt --all -- --check

# Run Clippy linter across all workspace crates
cargo clippy --workspace --all-targets -- -D warnings
```

### Frontend Linting (oxlint & TypeScript)
Aura-Lune uses `oxlint` for high-speed JS/TS linting and TypeScript compiler (`tsc`) for strict type checks:

```bash
# Run oxlint on frontend code
npm --prefix apps/desktop run lint

# Run strict TypeScript compilation check
npm --prefix apps/desktop run build
```

---

## 6. Testing Protocols

### Unified 4-Stage Test Runner
The repository provides a single, zero-Python bash script that executes the complete test suite across both frontend and backend:

```bash
./tests/run_all_tests.sh
```

This script executes four sequential validation stages:
1. **Frontend Unit & i18n Tests**: Runs all 39 Vitest suites (147+ unit tests).
2. **Frontend Type Check & Build**: Executes `tsc -b && vite build`.
3. **Rust Workspace Tests**: Runs all unit and integration tests across 11 workspace crates (`--test-threads=1`).
4. **Desktop Smoke Test**: Executes `tests/desktop_smoke_test.rs` to verify that the audio engine boots, storage migrations run, and desktop commands respond.

### Frontend Unit Tests (Vitest)
To run frontend tests independently:

```bash
# Single run
npm --prefix apps/desktop test

# Watch mode for interactive TDD
npm --prefix apps/desktop run test:watch
```

### Rust Workspace Unit & Integration Tests
To run Rust tests across all crates:

```bash
cargo test --workspace
```

To run tests for a specific crate:
```bash
cargo test -p audio-engine
cargo test -p domain
cargo test -p storage
cargo test -p metadata
cargo test -p downloads
```

### Desktop Smoke Test
To test the end-to-end desktop integration:

```bash
cargo test -p auralune-desktop --test desktop_smoke_test -- --nocapture
```

---

## 7. Building for Release

### Standard Release Build (AppImage & .deb)
To produce production-ready Linux distribution packages (AppImage and Debian package):

```bash
npm run tauri build
```
*Or from the desktop directory:*
```bash
cd apps/desktop
npm run tauri build
```

Tauri bundles the application using settings defined in [`apps/desktop/src-tauri/tauri.conf.json`](file:///home/kamu/Projects/Aura-Lune/apps/desktop/src-tauri/tauri.conf.json):
- Executes `beforeBuildCommand` (`npm run build`) to generate the optimized web bundle.
- Compiles the Rust backend with `--release` optimizations.
- Packages desktop entries, system icons, and dependencies into `.AppImage` and `.deb`.

### Optimized Standalone Binary
To compile only the optimized binary without building package bundles:

```bash
# Build frontend
npm --prefix apps/desktop run build

# Build release backend
cargo build --release -p auralune-desktop
```
The compiled binary will be located at:
```
target/release/auralune-desktop
```

### Release Artifact Outputs
After running `npm run tauri build`, the distribution artifacts are placed in:
```
apps/desktop/src-tauri/target/release/bundle/
├── appimage/
│   └── Auralune_1.1.5_amd64.AppImage
└── deb/
    └── auralune_1.1.5_amd64.deb
```

To test the generated AppImage:
```bash
chmod +x apps/desktop/src-tauri/target/release/bundle/appimage/Auralune_*.AppImage
./apps/desktop/src-tauri/target/release/bundle/appimage/Auralune_*.AppImage
```

### Universal Linux Installer (`install.sh`)

Aura-Lune provides an intelligent, rootless installer script that supports dual parallel channels (**Stable** and **Dev**) so that development builds never conflict with stable installations:

#### Installing Stable Version
```bash
curl -fsSL https://raw.githubusercontent.com/Das-Letzte-Kemonomimi/Aura-Lune/main/install.sh | bash
```
- Installs binary launcher to `~/.local/bin/auralune`
- Stores AppImage in `~/.local/share/auralune/auralune.AppImage`
- Registers desktop shortcut `~/.local/share/applications/auralune.desktop` (`Auralune`)

#### Installing Development Version (Parallel, Non-Conflicting)
To install the development build directly from the `dev` branch:
```bash
curl -fsSL https://raw.githubusercontent.com/Das-Letzte-Kemonomimi/Aura-Lune/dev/install.sh | bash -s -- --dev
```
*(Or in a local git repository on branch `dev`: `./install.sh`)*
- Installs binary launcher to `~/.local/bin/auralune-dev`
- Stores AppImage in `~/.local/share/auralune-dev/auralune-dev.AppImage`
- Registers separate desktop shortcut `~/.local/share/applications/auralune-dev.desktop` (`Auralune (Dev)`)
- Both stable and dev versions can be installed and run simultaneously without collision.
- Built-in GStreamer host plugin path auto-detection prevents missing audio sinks on minimal systems like Arch Linux.

#### Zero-Maintenance Merge Architecture
The installer automatically determines the target channel based on the following precedence:
1. Explicit CLI flags: `--dev` or `--stable`
2. Environment variables: `CHANNEL=dev` or `AURALUNE_CHANNEL=dev`
3. Git branch name: if cloned on `dev` or `develop` branch
4. Safe default: Remote curl invocations without flags strictly default to `stable`, guaranteeing that merging `dev` into `main` will never cause `main` to install development packages.
5. GitHub Pre-releases: Bleeding-edge AppImages are published automatically under tag `dev` and can be downloaded standalone from GitHub Releases or installed via `curl .../dev/install.sh | bash -s -- --dev`.

---

## 8. Troubleshooting & FAQs

### Missing GStreamer Plugins at Runtime
**Symptom**: Audio files fail to play or decode with errors like `no element "playbin"`, `flacparse missing`, or `pulsesink missing`.  
**Fix**: Ensure all plugin packages (`gst-plugins-good`, `gst-plugins-bad`, `gst-plugins-ugly`, `gst-libav`) are installed. Aura-Lune's AppImage setup automatically scans `/usr/lib/gstreamer-1.0` and `/usr/lib64/gstreamer-1.0` and populates `GST_PLUGIN_SYSTEM_PATH_1_0`.

### WebKit2GTK ABI Mismatches
**Symptom**: Compilation errors referring to `webkit2gtk-4.0` vs `webkit2gtk-4.1`.  
**Fix**: Aura-Lune targets modern `webkit2gtk-4.1` (using libsoup3). Ensure `libwebkit2gtk-4.1-dev` (or `webkit2gtk4.1-devel`) is installed, rather than the legacy 4.0 (libsoup2) package.

### Audio Pipeline Safety Violations
**Rule**: The audio callback thread in `audio-engine` and `dsp-*` **must never perform heap allocations, file I/O, network requests, or mutex locks**.  
**Verification**: When modifying DSP or GStreamer buffer callbacks, ensure data structures are pre-allocated and communicate with the main thread via atomic counters or lock-free channels.

### Wayland & Desktop Icons
Aura-Lune installs themed icons into `~/.local/share/icons/hicolor` and triggers `gtk-update-icon-cache` automatically when toggling between `lineout` and `classic` styles in the Settings view.

### Testing In-App Updates
The updater (Settings → Updates, `apps/desktop/src-tauri/src/updater/`) decides everything from the build identity and the environment, so it can be exercised without publishing a release:

- **Build identity** is embedded by `apps/desktop/src-tauri/build.rs`: `AURALUNE_BUILD_COMMIT` (else `GITHUB_SHA`, else `git rev-parse HEAD`) and `AURALUNE_BUILD_CHANNEL` (`dev`/`stable`, else derived from a `-dev` version suffix). Fake an outdated dev build with `AURALUNE_BUILD_COMMIT=0000000 npm --prefix apps/desktop run tauri build -- --bundles appimage`, then install it with `./install.sh --dev` from the local bundle; the badge appears ~30 s after startup, **Download & install** verifies the checksum and swaps the AppImage, **Restart now** relaunches through `~/.local/bin/auralune-dev`.
- **Install kind** comes from `APPIMAGE` (self-update only when it sits directly in `~/.local/share/auralune{,-dev}/` and is writable) and the build profile: unset `APPIMAGE` in a release build → `system` notice; debug builds without `APPIMAGE` → `dev_server` (no background checks). Exporting `APPIMAGE=~/.local/share/auralune-dev/auralune-dev.AppImage` and `AURALUNE_CHANNEL=dev` for `npm run tauri dev` exercises the managed UI path (do not press Install against your real AppImage). On the dev channel a plain `npm run tauri dev` run (no `APPIMAGE`) can also press **Download & install**: it writes `~/.local/share/auralune-dev/auralune-dev.AppImage` — i.e. it installs the dev build next to your source checkout.
- **Throttling**: the last check time and result live in the `update_last_checked` / `update_last_result` settings; a non-forced check within 6 h returns the cached result. **Check now** always forces a request.
- **Checksums**: releases must ship `SHA256SUMS` (or an asset `digest` from the API). The installer refuses to proceed without either.
- Rust tests: `cargo test -p auralune-desktop --test updates_test --test install_identity_test` (a local HTTP server stands in for GitHub); `cargo test -p domain --test version_test`. Vitest: `useUpdateManager.test.ts`, `UpdatesSettingsView.test.tsx`.

---

## 9. Continuous Integration (CI/CD)

The GitHub Actions workflow is defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and runs on all pushes, pull requests to `main`, `dev`, `develop`, and manual triggers (`workflow_dispatch`).

The pipeline is split into two specialized, concurrent jobs:

1. **`frontend` (Frontend Quality & Tests)**:
   - Sets up Node.js 22 LTS with `npm` caching.
   - Runs `npm --prefix apps/desktop ci`.
   - Runs `npm --prefix apps/desktop run lint` (`oxlint` code quality and React linting).
   - Runs `npm --prefix apps/desktop test` (Vitest unit and localization parity tests).
   - Runs `npm --prefix apps/desktop run build` (`tsc -b && vite build` TypeScript compilation and asset bundling).

2. **`backend-desktop` (Rust Backend & Desktop Quality)**:
   - Sets up Node.js 22 LTS and Rust stable with `rustfmt` and `clippy`.
   - Caches Rust dependencies and build targets using `Swatinem/rust-cache@v2`.
   - Installs system libraries (GStreamer 1.0 plugins, PipeWire, WebKit2GTK 4.1, Rubber Band, SoundTouch, PulseAudio).
   - Pre-builds frontend bundle to satisfy Tauri's `frontendDist` build requirement.
   - Verifies formatting via `cargo fmt --all --check`.
   - Enforces zero-warning lints via `cargo clippy --workspace --all-targets --all-features -- -D warnings`.
   - Configures headless audio daemon (`pulseaudio -D` with `module-null-sink`) to support real pipeline execution in headless VMs.
   - Runs the Rust workspace test suite (`cargo test --workspace -- --test-threads=1`).
   - Runs the desktop smoke test (`cargo test -p auralune-desktop --test desktop_smoke_test`).

---
*Maintained by Das Letzte Kemonomimi & Aura-Lune Core Engineering Agents.*
