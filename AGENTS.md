# AI Agent Instructions

## Overview

Aura-Lune is a Linux-first, Poweramp- and foobar2000-inspired music player with anime aesthetics, audiophile-grade DSP and real-time stem separation. It is a Tauri 2 desktop app: a React 19 + TypeScript frontend talks over typed IPC to a Rust host, which drives a GStreamer 0.25 audio engine and an SQLite library.

```
src/          React 19 frontend                      → src/AGENTS.md
src-tauri/    Tauri host crate `auralune-desktop`    → src-tauri/AGENTS.md
crates/       Core Rust crates (engine, storage, …)  → crates/AGENTS.md
tests/        CI-parity runner + fixtures
packaging/    AppImage, Arch packages, release helpers
docs/         developer/ reference, adr/, RELEASING.md
```

## Where instructions live

This file holds the rules for the whole repository. Each area has its own `AGENTS.md` with the rules for that code. Before you edit a file, read the nearest `AGENTS.md` above it, in addition to this one.

| Path | Guide | Covers |
|---|---|---|
| `src/` | [`src/AGENTS.md`](src/AGENTS.md) | React frontend: IPC, live playback state, views, modals, i18n, Vitest |
| `src-tauri/` | [`src-tauri/AGENTS.md`](src-tauri/AGENTS.md) | Tauri host: commands and their error, path and blocking contracts; setup; updater |
| `crates/` | [`crates/AGENTS.md`](crates/AGENTS.md) | Core crates: real-time audio safety, storage migrations, HTTP and path rules |
| deep reference | [`docs/developer/README.md`](docs/developer/README.md) | Module maps, hook lists, test matrix, updater design |

`CLAUDE.md` and `GEMINI.md` files only point back to these `AGENTS.md` files. Put instructions in `AGENTS.md`, never in the pointer files.

## Core Rules

### New Sessions

- Read the `AGENTS.md` for the area you will touch and skim `docs/developer/README.md`.
- Check `git status` and the current branch. Day-to-day work happens on `dev`.

### Development Practices

**CRITICAL:** Follow these strictly:

0. **Use npm only**: one `package.json` at the repo root. Use `npm install`, `npm run …`. Never pnpm, yarn or bun.
1. **Read Before Editing**: always read files first to understand context.
2. **Follow Established Patterns**: use the patterns in the `AGENTS.md` files and in `docs/developer/`.
3. **Senior Architect Mindset**: think about real-time audio safety, performance, maintainability and testability.
4. **Batch Operations**: use multiple tool calls in a single response.
5. **Match Code Style**: follow the formatting and patterns of the code around you.
6. **Test Coverage**: write tests for business logic and edge cases.
7. **Quality Gates**: run the checks below after significant changes and before finishing.
8. **No Unsolicited Commits**: commit only when explicitly asked.
9. **Early Returns**: prefer guard clauses over nested conditionals, in Rust and TypeScript.
10. **Zero Python**: tooling and tests stay native Rust (`cargo test`) and TypeScript (`vitest`). Never add Python scripts or harnesses.

**CRITICAL:** Use Tauri v2 docs only. Use Context7 for framework docs before web search. Use modern Rust formatting: `format!("{variable}")`.

> [!IMPORTANT]
> 1. **Pragmatic Testing (No Tests for Removed Features)**: Tests must strictly verify active invariants, working functionality, and edge cases. **Never write tests asserting that deliberately removed features, deprecated endpoints, or deleted UI elements do not exist**. Obsolete tests must simply be removed or updated.
> 2. **ALWAYS FORMAT, LINT & VERIFY BEFORE FINISHING (NON-NEGOTIABLE)**: Before committing, and before declaring any task done, **every agent MUST run the formatters and checks for every language it touched**. CI fails on a single unformatted line, and a task is *not finished* until all of these pass with 0 errors and 0 warnings:
>    - **Rust** (any `.rs` change, including tests): run `cargo fmt --all` (this *applies* formatting; then confirm with `cargo fmt --all --check`), then `cargo clippy --workspace --all-targets --all-features -- -D warnings`.
>    - **Frontend / Node.js** (any change under `src/`, `scripts/` or the frontend config files): run `npm run lint` (oxlint), `npm run typecheck` (`tsc -b`) and `npm test` (Vitest). There is no separate JS/TS auto-formatter. Match the surrounding code style and fix every lint finding.
>    - **Shell scripts** (any `.sh` change): `bash -n <file>`.
>    - Simplest path: `./tests/run_all_tests.sh --fix` from the repository root (runs `cargo fmt` first, then the full CI-parity suite).
>    - Re-run the formatters **after your last edit** (formatting after the final change, not before it) and commit the formatting result together with the work. Never hand work back with "CI will format it" or an unchecked formatting state.

## Build & Test Commands

```bash
# Setup (system packages: see DEVELOPMENT.md)
npm install                    # Frontend deps (root package.json)
cargo check --workspace        # Rust workspace compiles

# Dev
npm run tauri dev              # Full desktop app with Vite HMR on :5173
npm run dev                    # Frontend only in a browser (no Tauri APIs)

# Quality gates (run before committing)
cargo fmt --all
cargo clippy --workspace --all-targets --all-features -- -D warnings
npm run lint                   # oxlint
npm run typecheck              # tsc -b
npm test                       # Vitest (jsdom)
./tests/run_all_tests.sh --fix # Everything above + Rust tests + smoke test + bash -n

# Single tests
npx vitest run src/hooks/useToasts.test.ts
cargo test -p storage --test schema_migrations_test
cargo test -p auralune-desktop --test ipc_contract_test

# Code generation
npm run gen:commands           # Refresh src/api/commands.generated.ts after adding/removing a command

# Builds
npm run build                  # tsc -b && vite build
npm run tauri build -- --bundles appimage
./tests/run_all_tests.sh --bundle

# Release helpers (normally run by the release workflows)
packaging/check-release-content.sh X.Y.Z
packaging/bump-version.sh X.Y.Z
```

## Code Style

- **Formatting**: `rustfmt` defaults for Rust. TypeScript has no auto-formatter: match the surrounding style.
- **Errors**: crates return their own `thiserror` enums, and Tauri commands return `Result<T, CommandError>`. Never `Result<_, String>` in new code. In TypeScript use `catch (e: unknown)` with `errorMessage(e)`.
- **Tests outside production sources**: no inline `#[cfg(test)] mod tests` blocks. Use the crate's `tests/` dir, or a companion `_test.rs` referenced with `#[cfg(test)] #[path = "…"]`.
- **Language**: everything is in English: code, identifiers, code comments, docs, error contexts and commit messages. When you edit a file that still has Polish comments, translate the ones you touch. The single exception is `CHANGELOG_PENDING.md`, which is written in Polish (see Commits & Pull Requests).
- **Toolchain**: Node.js 22 LTS (`.nvmrc`), npm ≥ 10; Rust stable from `rust-toolchain.toml` (edition 2021) with `rustfmt` and `clippy`.

## Testing

- Rust tests live in each crate's `tests/` directory (or `src/*_test.rs` companions). Frontend tests live next to their sources as `*.test.ts(x)` and run in Vitest with jsdom.
- `./tests/run_all_tests.sh` mirrors CI in seven stages: rustfmt check → oxlint + Vitest → `tsc -b && vite build` → clippy → `cargo test --workspace -- --test-threads=1` → desktop smoke test → `bash -n` on every script. Flags: `--fix` (format first), `--fast` (skip long audio tests), `--bundle` (also build the AppImage).
- GStreamer playback tests need the system plugins listed in `DEVELOPMENT.md`. Run the Rust suite single-threaded.
- The test matrix per crate is in [`docs/developer/testing.md`](docs/developer/testing.md).

## Security Considerations

- **User files are read-only**: the player never modifies a user's audio files except through explicit tag edits and renames, resolved from the database by `track_id` (see `docs/architecture.md` §7).
- **WebView CSP**: `src-tauri/tauri.conf.json` has a strict `csp` and `devCsp`, guarded by `src-tauri/tests/security_config_test.rs`. Never loosen `connect-src` to make network calls from the WebView. Network traffic belongs in Rust.
- **Paths from the UI** go through `commands/paths.rs` (`ensure_writable` / `ensure_readable`) and `domain::paths::check_write_target`. Never read or write a raw UI string path.
- **Outbound HTTP**: URLs chosen by the UI must pass `metadata::net_guard::ensure_public_https_url`. HTTP clients come from `metadata::http::build_client`, which refuses redirects to private hosts.
- **Updater**: GitHub hosts only. Installation needs a SHA-256 from the asset digest or `SHA256SUMS`, otherwise it is refused.
- **IPC files** live only in the private `$XDG_RUNTIME_DIR/auralune/` (0700), never directly in `/tmp`.
- **Secrets**: never commit tokens or API keys (Last.fm, ListenBrainz, AcoustID, `RELEASE_TOKEN`). User credentials live in the app settings database, not in the repo.

## Commits & Pull Requests

- **Conventional Commits** with a scope, as in the history: `feat(updates): …`, `fix(player): …`, `refactor(storage): …`, `ci(release): …`, `docs(agents): …`. Imperative, lowercase summary; bullets in the body for details.
- **Branches**: integrate on `dev`. Large changes go on a topic branch merged into `dev`. `main` only receives release PRs (`release/vX.Y.Z` → `main`, merge commit).
- **Changelog**: record every user-facing change in `CHANGELOG_PENDING.md`, in Polish, under the headings `Dodano`, `Poprawiono`, `Zmieniono`. It is the only Polish file agents write.
- **Never** force-push `main`, push tags by hand, skip hooks (`--no-verify`) or add a second release path.

## Releases: DO NOT tag or publish manually

Stable releases run only through the manual GitHub Actions workflows. Merging never publishes. Full guide: [`docs/RELEASING.md`](docs/RELEASING.md) ([Polish](docs/RELEASING.pl.md)); the `release` skill automates the content step.

1. On `dev`: release content (`CHANGELOG.md` block, 5-language `src/data/changelog.json`, README badges, reset `CHANGELOG_PENDING.md`), checked with `packaging/check-release-content.sh X.Y.Z`.
2. Actions → **Prepare release** (on `dev`): validates, runs `packaging/bump-version.sh`, opens the `release/vX.Y.Z` → `main` PR.
3. Review and merge the PR with a merge commit.
4. Actions → **Publish release** (on `main`): CI + AppImage build, draft with every asset and `SHA256SUMS`, then publish.
5. Afterwards: `packaging/archlinux/update-aur-checksum.sh X.Y.Z` + `publish-to-aur.sh`; on `dev` merge `origin/main` and run `packaging/bump-version.sh X.Y.(Z+1)-dev`.

### Version bump keywords (semantic versioning)

| Conventional commit type | Release type | Version bump |
|---|---|---|
| `fix:`, `docs:`, `chore:`, `style:`, `refactor:` | **patch release** | `Z` +1 (1.1.5 → 1.1.6) |
| `feat:` (backward-compatible) | **minor release** | `Y` +1 (1.1.5 → 1.2.0) |
| `feat!:` / breaking change (settings or DB format without migration, removed IPC behaviour, dropped install path) | **major release** | `X` +1 (1.1.5 → 2.0.0) |

**Rule of thumb:** only fixes, docs or internal refactors → patch. New features, views or commands that keep existing behaviour → minor. Breaking user data, installs or public behaviour → major.

## Skills & Agents

Project skills live in `skills/<area>/<name>/SKILL.md` (linked into `.claude/skills/` where a tool needs it):

- `release`: release content and the Prepare/Publish workflows
- `run-workflow`: write and run multi-agent workflow scripts
- `audio-dsp-safety`, `tauri2-architecture`, `react-monolith-refactor`, `i18n-sync`, `tailwind-v4`: area checklists
