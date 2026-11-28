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
5. [Development Pipeline](#5-development-pipeline)
6. [Agent Skills (Claude Code and Antigravity)](#6-agent-skills-claude-code-and-antigravity)
   - [How the shared set works](#how-the-shared-set-works)
   - [Everyday commands](#everyday-commands)
   - [Adding, removing and updating skills](#adding-removing-and-updating-skills)
   - [Skill troubleshooting](#skill-troubleshooting)
7. [Code Quality & Linting](#7-code-quality--linting)
   - [Rust Code Formatting & Clippy](#rust-code-formatting--clippy)
   - [Frontend Linting (oxlint & TypeScript)](#frontend-linting-oxlint--typescript)
8. [Testing Protocols](#8-testing-protocols)
   - [Unified CI-Parity Test Runner](#unified-ci-parity-test-runner)
   - [Frontend Unit Tests (Vitest)](#frontend-unit-tests-vitest)
   - [Rust Workspace Unit & Integration Tests](#rust-workspace-unit--integration-tests)
   - [Desktop Smoke Test](#desktop-smoke-test)
9. [Building for Release](#9-building-for-release)
   - [Standard Release Build (AppImage & .deb)](#standard-release-build-appimage--deb)
   - [Optimized Standalone Binary](#optimized-standalone-binary)
   - [Release Artifact Outputs](#release-artifact-outputs)
10. [Troubleshooting & FAQs](#10-troubleshooting--faqs)
11. [Continuous Integration (CI/CD)](#11-continuous-integration-cicd)

---

## 1. System Prerequisites

Aura-Lune relies on modern Linux audio and GUI frameworks:
- **Audio**: GStreamer 1.0 (with `base`, `good`, `bad`, `ugly`, and `libav` plugins), PipeWire / ALSA.
- **DSP**: `librubberband` (high-fidelity formant-preserving stretch) and `libsoundtouch` (low-latency time/pitch).
- **GUI**: WebKit2GTK 4.1 (`libsoup-3.0`) **2.40 or newer** (the Tailwind CSS v4 stylesheet needs cascade layers, `@property` and `color-mix()`), GTK 3, and D-Bus (for MPRIS).
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
Aura-Lune targets **Node.js 22 (Active LTS)** and **npm >= 10**. A `.nvmrc` file is provided in the repository root. Use a recent 22.x release (**22.20 or newer**): the `npx skills` CLI that manages the [agent skills](#6-agent-skills-claude-code-and-antigravity) requires it. npm only: never pnpm, yarn or bun.

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
Aura-Lune uses modern **Rust stable (1.80+ / 1.99+)**. A [`rust-toolchain.toml`](rust-toolchain.toml) file is pinned at the repository root with `rustfmt` and `clippy` components enabled.

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
git clone https://github.com/Das-Letzte-Kemonomimi/Aura-Lune.git
cd Aura-Lune

# Install frontend dependencies (single package.json at the repo root)
npm install
```

Verify that the Rust workspace compiles:
```bash
cargo check --workspace
```

Install the shared AI agent skills for Claude Code and Antigravity from `skills-lock.json` and `skills/` (they are gitignored and installed on demand; see [Agent Skills](#6-agent-skills-claude-code-and-antigravity)):
```bash
npm run skills:check || npm run skills:install
```

---

## 4. Development Workflow

### Running Frontend in Browser Dev Mode
You can develop UI components, layout, and theme styles in a regular browser window with hot-module reloading (HMR):

```bash
npm run dev
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
npm exec tauri dev
```

During development:
- Edits in `src/**` automatically hot-reload in the desktop window.
- Edits in `src-tauri/**` or `crates/**` automatically trigger a Rust recompile and app restart.

---

## 5. Development Pipeline

This is the path every change takes, from a clean checkout to a published release. The rules behind it live in [`AGENTS.md`](AGENTS.md); this section is the how-to.

```
 branch ──▶ change ──▶ quality gates ──▶ changelog ──▶ commit ──▶ CI ──▶ release
 (dev)      + tests    (after the last    (if user-     (Conven-   (push/    (manual
                       edit)               facing)       tional)    PR)       workflows)
```

| # | Stage | What to do |
|---|---|---|
| 1 | **Prepare** | `git status`, then work on `dev` (large changes: a topic branch merged into `dev`). Read the nearest `AGENTS.md` for the area you touch. Run `npm run skills:check`. |
| 2 | **Change** | Follow the patterns in the area's `AGENTS.md` and `docs/developer/`. Write tests with the change: Rust tests in the crate's `tests/` dir (or a `_test.rs` companion), frontend tests next to the source as `*.test.ts(x)`. Everything is in English. After adding or removing a Tauri command run `npm run gen:commands`. |
| 3 | **Quality gates** | Run them **after your last edit**; CI fails on a single unformatted line. See the table below, or run everything with `./tests/run_all_tests.sh --fix`. |
| 4 | **Changelog** | Humanize user-facing changes and append them directly to the active `isDev` entry in `src/data/changelog.json` via `npm run changelog:add` (5 locales; rules in [`CHANGELOG.md`](CHANGELOG.md), automation in [`docs/developer/agent-pipelines.md`](docs/developer/agent-pipelines.md)). Developer tooling and pure refactors do not need an entry. |
| 5 | **Commit** | [Conventional Commits](https://www.conventionalcommits.org/) with a scope: `feat(updates): …`, `fix(player): …`, `refactor(storage): …`, `docs(agents): …`. Imperative, lowercase summary, bullets in the body. Never skip hooks (`--no-verify`) and never force-push `main`. |
| 6 | **CI** | Pushes and pull requests to `main`, `dev` or `develop` run the two jobs described in [section 11](#11-continuous-integration-cicd). A push to `dev` also publishes the rolling dev AppImage with unreleased dev notes from `changelog.json`. |
| 7 | **Release** | Never tag or publish by hand. See below. |

Quality gates by language:

| You changed | Run |
|---|---|
| Rust (`.rs`, including tests) | `cargo fmt --all`, then `cargo fmt --all --check`, then `cargo clippy --workspace --all-targets --all-features -- -D warnings`, then `cargo test --workspace -- --test-threads=1` |
| Frontend (`src/`, `scripts/`, frontend config) | `npm run lint`, `npm run typecheck`, `npm test` (there is no JS/TS auto-formatter: match the surrounding style) |
| Changelog (`src/data/changelog.json`) | `npm run changelog:validate` (also covered by `npm test`) |
| Shell scripts (`.sh`) | `bash -n <file>` |
| Skills (`skills/`, `skills-lock.json`) | `npm run skills:check` |
| Everything | `./tests/run_all_tests.sh --fix` (formats Rust first, then runs the CI-parity suite) |

**Releasing** is prepared locally with one command and published automatically when pushing `main` and `dev`:

1. On `dev`, run `npm run release:prepare -- [patch|minor|major|X.Y.Z] --codename "..."` (promotes `src/data/changelog.json`, updates README badges, bumps all version files via `packaging/bump-version.sh`, runs `./tests/run_all_tests.sh --fix`, commits on `dev`, merges `dev` → `main` with `--no-ff`, and bumps `dev` to `X.Y.(Z+1)-dev`).
2. Push both branches: `git push origin main dev`.
   - `origin/main` automatically runs CI, builds `AppImage` + `.deb`, generates `SHA256SUMS`, and publishes GitHub Release `vX.Y.Z`.
   - `origin/dev` automatically runs CI and updates the rolling `dev-build` pre-release.
3. Optional post-publish (AUR): `npm run release:aur -- X.Y.Z`.

The version bump follows the commit types: `fix`, `docs`, `chore`, `style`, `refactor` → patch; `feat` → minor; `feat!` or any breaking change → major. Full guides: [`docs/developer/release-pipeline.md`](docs/developer/release-pipeline.md) and [`docs/RELEASING.md`](docs/RELEASING.md).

---

## 6. Agent Skills (Claude Code and Antigravity)

Skills are folders with a `SKILL.md` that teach an AI coding agent a task (real-time audio safety, Tauri IPC rules, how to cut a release, …). Aura-Lune ships one curated set that **Claude Code and Antigravity load identically**. The list, with a one-line "use when" for each skill, is in the [Skills & Agents table in `AGENTS.md`](AGENTS.md#skills--agents).

### How the shared set works

Both agents already agree on a file format ([`SKILL.md`](https://agentskills.io)); they differ only in which directory they scan. The repository fills both:

| Agent | Reads project skills from | How they get there |
|---|---|---|
| Antigravity (App and CLI) | `.agents/skills/` | Gitignored; populated by `npm run skills:install`. Third-party skills are real folders, authored skills are symlinks into `skills/`. |
| Claude Code | `.claude/skills/` | Gitignored; symlinks into `.agents/skills/` created by `npm run skills:install`. |

```
skills/<area>/<name>/SKILL.md    authored project skills (committed): the only place to edit them
skills-lock.json                 pins every third-party skill (committed: source, commit, content hash)
.agents/skills/<name>            gitignored · third-party: real folder · authored: symlink into skills/
.claude/skills/<name>            gitignored · symlink to ../../.agents/skills/<name>
```

Only `skills/` and `skills-lock.json` are committed, so the repository stays lean and agents or contributors install the third-party skills themselves on first setup (`npm run skills:install`). `npx skills` is the tool behind everything: it restores the third-party folders from `skills-lock.json` (hash-verified) and pulls newer versions, while `npm run skills:*` ([`scripts/skills.mjs`](scripts/skills.mjs)) wraps it and adds the authored-skill links so both agents always end up with the same set. Other agents that read `.agents/skills/` (Codex, Cursor, Gemini CLI, GitHub Copilot, …) get the set too.

Two kinds of skills are deliberately **not** shared: ones that depend on one tool's API. Antigravity ships its own built-in `run-workflow` (a `run_workflow` tool that runs Python scripts), and Claude Code has its own subagent tools. The portable replacement is `dispatching-parallel-agents`.

### Everyday commands

| Command | Needs network | What it does |
|---|---|---|
| `npm run skills:check` | no | Verifies every expected skill resolves for **both** agents and that authored skills have matching names (`scripts/skills.test.mjs` also runs under `npm test`). Exit code 1 plus the list of missing entries otherwise. |
| `npm run skills:install` | yes | **Repair.** Restores third-party skills from `skills-lock.json` (hash-verified), recreates the Claude links and the authored-skill links, then runs the check. Run it when the check fails or after switching branches that changed skills. |
| `npm run skills:update` | yes | Moves every locked skill to the newest upstream commit, rewrites `skills-lock.json`, relinks and checks. Review the diff before committing. |

Raw `npx` equivalents (the scripts pin `skills@1.9.0`; any recent version works by hand): `npx skills list` (shows `modified`, `untracked` and `missing` skills), `npx skills check` (available updates and local changes), `npx skills experimental_install -a claude-code -a antigravity` (restore), `npx skills update -p -y` (update).

### Adding, removing and updating skills

**Add a third-party skill.** Only add one that is relevant to this stack and well rated; prefer one good skill over several overlapping ones.

```bash
npx skills find tauri                    # search, compare install counts on https://skills.sh
npx skills add <owner/repo> --skill <name> -a claude-code -a antigravity -y
npm run skills:check
```

Then add a row to the table in [`AGENTS.md`](AGENTS.md#skills--agents) and commit `skills-lock.json` together with `AGENTS.md`. Do not hand-edit `.agents/skills/`; change it upstream or pin another source.

**Remove one:** `npx skills remove <name>`, delete its row from `AGENTS.md`, commit `skills-lock.json` and `AGENTS.md`.

**Add an authored skill.** Create `skills/<area>/<name>/SKILL.md` with frontmatter whose `name` equals the folder name and a `description` that says what it does and when to use it, then run `npm run skills:install` (it creates both links) and add the `AGENTS.md` row. Keep it harness-neutral: no instructions that only one tool can follow (`run_workflow`, a specific `Agent` or `AskUserQuestion` call, …). Use the `skills/` tree, not `.agents/skills/`, so the source of truth stays in one place.

**Update.** `npm run skills:update`, review the diff of the vendored files (third-party instructions are code you are choosing to trust), run `npm run skills:check`, commit.

**Personal skills** that should not be shared go in your home directory (`~/.claude/skills/` for Claude Code, `~/.gemini/config/skills/` for Antigravity) and are never committed.

### Skill troubleshooting

| Symptom | Fix |
|---|---|
| `skills:check` lists missing entries | `npm run skills:install`. |
| `The skills CLI needs Node >= 22.20` | `nvm install 22` (the latest 22.x satisfies it), then `nvm use`. |
| `npx skills list` shows a skill as `modified` | Someone edited a vendored file. Restore it with `npx skills experimental_install --force -a claude-code -a antigravity`, or run `npm run skills:update` if upstream changed. |
| A new skill does not show up in Antigravity or Claude | Start a new conversation. In the Antigravity CLI run `/skills reload`. |
| Links are broken after cloning on a filesystem without symlinks | Enable symlinks (Windows: Developer Mode and `git config core.symlinks true`), re-clone, then `npm run skills:install`. |
| `.claude/settings.json` or `.claude/worktrees/` shows up in `git status` | Neither `.agents/` nor `.claude/` should be tracked; check that `.gitignore` ignores `.agents/` and `.claude/`. |

---

## 7. Code Quality & Linting

### Rust Code Formatting & Clippy
Always maintain strict formatting and clippy compliance:

```bash
# Format all crates in the workspace
cargo fmt --all

# Check formatting without modifying files
cargo fmt --all -- --check

# Run Clippy linter across all workspace crates (zero warnings, same flags as CI)
cargo clippy --workspace --all-targets --all-features -- -D warnings
```

### Frontend Linting (oxlint & TypeScript)
Aura-Lune uses `oxlint` for high-speed JS/TS linting and TypeScript compiler (`tsc`) for strict type checks:

```bash
# Run oxlint on frontend code
npm run lint

# Run strict TypeScript compilation check (no emit)
npm run typecheck
```

There is no separate JS/TS auto-formatter: match the surrounding style and fix every lint finding.

---

## 8. Testing Protocols

### Unified CI-Parity Test Runner
The repository provides a single, zero-Python bash script that mirrors the CI jobs across both frontend and backend:

```bash
./tests/run_all_tests.sh           # full CI-parity suite
./tests/run_all_tests.sh --fix     # run `cargo fmt --all` first, then the suite
./tests/run_all_tests.sh --fast    # format, lint, typecheck and clippy only (skips the audio tests)
./tests/run_all_tests.sh --bundle  # also build the AppImage (mirrors the dev-release job)
```

The script executes seven sequential stages:
1. **Rust formatting**: `cargo fmt --all --check`.
2. **Frontend lint and tests**: `oxlint` and the Vitest suites (unit tests plus the i18n parity checks).
3. **Frontend type check and build**: `tsc -b && vite build`.
4. **Clippy**: `cargo clippy --workspace --all-targets --all-features -- -D warnings`.
5. **Rust workspace tests**: all unit and integration tests, single-threaded (`--test-threads=1`).
6. **Desktop smoke test**: `tests/desktop_smoke_test.rs` verifies that the audio engine boots, storage migrations run, and desktop commands respond.
7. **Shell syntax**: `bash -n` on every script.

### Frontend Unit Tests (Vitest)
To run frontend tests independently:

```bash
# Single run
npm test

# Watch mode for interactive TDD
npm run test:watch
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

## 9. Building for Release

### Standard Release Build (AppImage & .deb)
To produce production-ready Linux distribution packages (AppImage and Debian package):

```bash
npm run tauri build
```

Tauri bundles the application using settings defined in [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json):
- Executes `beforeBuildCommand` (`npm run build`) to generate the optimized web bundle.
- Compiles the Rust backend with `--release` optimizations.
- Packages desktop entries, system icons, and dependencies into `.AppImage` and `.deb`.

### Optimized Standalone Binary
To compile only the optimized binary without building package bundles:

```bash
# Build frontend
npm run build

# Build release backend
cargo build --release -p auralune-desktop
```
The compiled binary will be located at:
```
target/release/auralune-desktop
```

### Release Artifact Outputs
After running `npm run tauri build`, the distribution artifacts are placed in the workspace `target/` directory:
```
target/release/bundle/
├── appimage/
│   └── Auralune_2.1.1_amd64.AppImage
└── deb/
    └── auralune_2.1.1_amd64.deb
```

To test the generated AppImage:
```bash
chmod +x target/release/bundle/appimage/Auralune_*.AppImage
./target/release/bundle/appimage/Auralune_*.AppImage
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

## 10. Troubleshooting & FAQs

### Missing GStreamer Plugins at Runtime
**Symptom**: Audio files fail to play or decode with errors like `no element "uridecodebin"`, `audiodynamic missing`, `flacparse missing`, or `pulsesink missing`.  
**Fix**: Ensure all plugin packages (`gst-plugins-good`, `gst-plugins-bad`, `gst-plugins-ugly`, `gst-libav`) are installed. Aura-Lune's AppImage setup automatically scans `/usr/lib/gstreamer-1.0` and `/usr/lib64/gstreamer-1.0` and populates `GST_PLUGIN_SYSTEM_PATH_1_0`.

> **Headless / sandbox note**: Running the full GStreamer playback tests (`audio-engine`) and `desktop_smoke_test` requires a running PulseAudio/PipeWire session (CI starts `pulseaudio` with `module-null-sink`), and `crates/metadata`'s online Cover Art Archive test currently requires outbound internet access.

### WebKit2GTK ABI Mismatches
**Symptom**: Compilation errors referring to `webkit2gtk-4.0` vs `webkit2gtk-4.1`.  
**Fix**: Aura-Lune targets modern `webkit2gtk-4.1` (using libsoup3). Ensure `libwebkit2gtk-4.1-dev` (or `webkit2gtk4.1-devel`) is installed, rather than the legacy 4.0 (libsoup2) package.

### Audio Pipeline Safety Violations
**Rule**: The audio callback thread in `audio-engine` and `dsp-*` **must never perform heap allocations, file I/O, network requests, or mutex locks**.  
**Verification**: When modifying DSP or GStreamer buffer callbacks, ensure data structures are pre-allocated and communicate with the main thread via atomic counters or lock-free channels.

### Wayland & Desktop Icons
Aura-Lune installs themed icons into `~/.local/share/icons/hicolor` and triggers `gtk-update-icon-cache` automatically when toggling between `lineout` and `classic` styles in the Settings view.

### Testing In-App Updates
The updater (Settings → Updates, `src-tauri/src/updater/`) decides everything from the build identity and the environment, so it can be exercised without publishing a release:

- **Build identity** is embedded by `src-tauri/build.rs`: `AURALUNE_BUILD_COMMIT` (else `GITHUB_SHA`, else `git rev-parse HEAD`) and `AURALUNE_BUILD_CHANNEL` (`dev`/`stable`, else derived from a `-dev` version suffix). Fake an outdated dev build with `AURALUNE_BUILD_COMMIT=0000000 npm run tauri build -- --bundles appimage`, then install it with `./install.sh --dev` from the local bundle; the badge appears ~30 s after startup, **Download & install** verifies the checksum and swaps the AppImage, **Restart now** relaunches through `~/.local/bin/auralune-dev`.
- **Install kind** comes from `APPIMAGE` (self-update only when it sits directly in `~/.local/share/auralune{,-dev}/` and is writable) and the build profile: unset `APPIMAGE` in a release build → `system` notice; debug builds without `APPIMAGE` → `dev_server` (no background checks). Exporting `APPIMAGE=~/.local/share/auralune-dev/auralune-dev.AppImage` and `AURALUNE_CHANNEL=dev` for `npm run tauri dev` exercises the managed UI path (do not press Install against your real AppImage). On the dev channel a plain `npm run tauri dev` run (no `APPIMAGE`) can also press **Download & install**: it writes `~/.local/share/auralune-dev/auralune-dev.AppImage` — i.e. it installs the dev build next to your source checkout.
- **Throttling**: the last check time and result live in the `update_last_checked` / `update_last_result` settings; a non-forced check within 6 h returns the cached result. **Check now** always forces a request.
- **Checksums**: releases must ship `SHA256SUMS` (or an asset `digest` from the API). The installer refuses to proceed without either.
- Rust tests: `cargo test -p auralune-desktop --test updates_test --test install_identity_test` (a local HTTP server stands in for GitHub); `cargo test -p domain --test version_test`. Vitest: `useUpdateManager.test.ts`, `UpdatesSettingsView.test.tsx`.

---

## 11. Continuous Integration (CI/CD)

The GitHub Actions workflow is defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and runs on all pushes, pull requests to `main`, `dev`, `develop`, and manual triggers (`workflow_dispatch`).

The pipeline is split into two specialized, concurrent jobs:

1. **`frontend` (Frontend Quality & Tests)**:
   - Sets up Node.js 22 LTS with `npm` caching.
   - Runs `npm ci`.
   - Runs `npm run lint` (`oxlint` code quality and React linting).
   - Runs `npm test` (Vitest unit and localization parity tests).
   - Runs `npm run build` (`tsc -b && vite build` TypeScript compilation and asset bundling).

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
