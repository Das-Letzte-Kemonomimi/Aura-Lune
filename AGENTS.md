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
| agent pipelines | [`docs/developer/agent-pipelines.md`](docs/developer/agent-pipelines.md) | End-to-end automated pipelines (skills, IPC codegen, changelog, quality gates, releases) |
| changelog rules | [`CHANGELOG.md`](CHANGELOG.md) | Humanization guide, `src/data/changelog.json` rules, and `npm run changelog:*` commands |
| setup, pipeline, skills | [`DEVELOPMENT.md`](DEVELOPMENT.md) | System packages, toolchain, the development pipeline, installing and updating the agent skills ([Agent skills](DEVELOPMENT.md#6-agent-skills-claude-code-and-antigravity)) |

`CLAUDE.md` and `GEMINI.md` files only point back to these `AGENTS.md` files. Put instructions in `AGENTS.md`, never in the pointer files.

## Core Rules

### New Sessions

- Read the `AGENTS.md` for the area you will touch and skim `docs/developer/README.md`.
- Check `git status` and the current branch. Day-to-day work happens on `dev`.
- Run `npm run skills:check` at session start. Third-party skills are not committed (only `skills/` and `skills-lock.json` are); if any entry is missing, run `npm run skills:install` (needs network + Node ≥ 22.20), then reload skills (`/skills reload` or start a new session).

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

# Code generation & changelog
npm run gen:commands           # Refresh src/api/commands.generated.ts after adding/removing a command
npm run changelog:add          # Append a humanized 5-language entry to the active dev entry in changelog.json
npm run changelog:validate     # Check changelog.json schema, dev/latest flags, and 5-language parity
npm run changelog:promote      # Promote the active dev entry to a stable X.Y.Z release

# Agent skills (Claude Code and Antigravity share one set)
npm run skills:check           # Offline: every skill in the table below exists for both agents
npm run skills:install         # Repair: restore from skills-lock.json and relink
npm run skills:update          # Pull the newest upstream skill versions and rewrite the lock

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
- **Language**: everything is in English: code, identifiers, code comments, docs, error contexts and commit messages. When you edit a file that still has Polish comments, translate the ones you touch. In [`src/data/changelog.json`](src/data/changelog.json), every entry ships in all 5 UI locales (`en`, `pl`, `de`, `fi`, `la`).
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
- **Changelog**: read [`CHANGELOG.md`](CHANGELOG.md) and follow [`docs/developer/agent-pipelines.md`](docs/developer/agent-pipelines.md). For user-facing changes on `dev`, rewrite notes in plain, non-technical language for listeners and add them directly to [`src/data/changelog.json`](src/data/changelog.json) (`"isDev": true`) via `npm run changelog:add` (five languages: `en`, `pl`, `de`, `fi`, `la`), then verify with `npm run changelog:validate`. Do not add entries for internal-only refactors, tests, CI, or docs.
- **Never** force-push `main`, push tags by hand, skip hooks (`--no-verify`) or add a second release path.

## Releases: DO NOT tag or publish manually

Stable releases run only through the manual GitHub Actions workflows. Merging never publishes. Full guide: [`docs/RELEASING.md`](docs/RELEASING.md) ([Polish](docs/RELEASING.pl.md)); the `release` skill automates the content step.

1. On `dev`: promote the active dev changelog (`npm run changelog:promote -- X.Y.Z "Codename"`), update README badges, and check with `packaging/check-release-content.sh X.Y.Z`.
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

Claude Code and Antigravity load the same skills. Setup, update and troubleshooting: [`DEVELOPMENT.md`, Agent skills](DEVELOPMENT.md#6-agent-skills-claude-code-and-antigravity).

- **Authored skills** live in `skills/<area>/<name>/SKILL.md`. That is the only place to edit them.
- **Third-party skills** are pinned in `skills-lock.json` (source, commit, content hash) and installed on demand with `npx skills` through `npm run skills:install` / `skills:update`. Never hand-edit `.agents/skills/`; change upstream or run `npm run skills:update`.
- **`.agents/skills/`** (Antigravity) and **`.claude/skills/`** (Claude Code symlinks) are gitignored and populated by `npm run skills:install`. Agents should run `npm run skills:check` (and `npm run skills:install` if missing) when starting work in a fresh checkout.
- A new project skill must be harness-neutral: no instructions that depend on one tool's API (`run_workflow`, `Agent`, `AskUserQuestion`, …). Add it under `skills/<area>/<name>/`, run `npm run skills:install` (or relink), and add a row to the table below.
- Add a third-party skill only when it is relevant to this stack and highly rated (check installs on [skills.sh](https://skills.sh)). Prefer one good skill over several overlapping ones.

| Skill | Origin | Use when |
|---|---|---|
| `audio-dsp-safety` | project | Touching `audio-engine`, `dsp-*` or GStreamer callbacks: real-time safety, underruns |
| `tauri2-architecture` | project | Adding or changing Tauri commands, state, or module layout |
| `react-monolith-refactor` | project | Extracting hooks or splitting large components such as `App.tsx` |
| `tailwind-v4` | project | Writing or migrating any `className`/`style` in `src/` |
| `i18n-sync` | project | Adding or changing user-visible strings: key parity across the five locales |
| `release` | project | Cutting a release (changelog, badges, Prepare/Publish workflows, AUR) |
| `tauri-v2` | `nodnarbnitram/claude-code-extensions` | `tauri.conf.json`, capabilities, permissions, plugin and IPC APIs |
| `rust-best-practices` | `apollographql/skills` | Writing or reviewing idiomatic Rust: ownership, errors, performance |
| `rust-async-patterns` | `wshobson/agents` | Tokio and async Rust in the host, downloads and metadata crates |
| `rust-testing` | `affaan-m/ecc` | Writing Rust unit, integration and async tests |
| `property-based-testing` | `trailofbits/skills` | Invariant tests for DSP maths, parsers and encode/decode pairs |
| `vitest` | `antfu/skills` | Writing or configuring frontend tests |
| `vite` | `antfu/skills` | `vite.config.ts`, plugins, build behaviour |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | React performance (ignore the Next.js-only rules; this is a Vite app) |
| `web-design-guidelines` | `vercel-labs/agent-skills` | Reviewing UI code for accessibility and interface guidelines |
| `systematic-debugging` | `obra/superpowers` | Any bug, failing test or odd behaviour, before proposing a fix |
| `verification-before-completion` | `obra/superpowers` | Before claiming work is done: run the gates, show the output |
| `dispatching-parallel-agents` | `obra/superpowers` | Two or more independent tasks; the portable way to fan out work |
| `prune-tests` | `caldoai/skills` | Removing tests that guard no behaviour (user-invoked) |
| `untangle-codebase` | `caldoai/skills` | Whole-codebase dependency clean-up (user-invoked: `/untangle-codebase`) |
