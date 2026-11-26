# Agent & Contributor Pipelines

A practical map of the automated pipelines in Aura-Lune so both human contributors and AI coding agents follow the exact same workflow. Repository rules remain in [`AGENTS.md`](../../AGENTS.md).

```
  1. Session Bootstrap ──▶ 2. Code & IPC Contract ──▶ 3. Changelog (dev) ──▶ 4. Quality Gates ──▶ 5. CI & Release
   (skills:check)           (gen:commands / tests)     (changelog:add)        (run_all_tests.sh)   (dev-build / /release)
```

---

## 1. Session Bootstrap & Skills Pipeline

Third-party agent skills are **not committed** to git — only authored project skills under `skills/` and pins in `skills-lock.json` live in the repository.

```bash
npm run skills:check      # Fast offline check (Claude Code + Antigravity symlinks match lock + skills/)
npm run skills:install    # Restore missing third-party skills from skills-lock.json and relink both agents
npm run skills:update     # Pull upstream skill updates and rewrite skills-lock.json (maintainer action)
```

- **When `skills:check` fails**: run `npm run skills:install` (requires network + Node ≥ 22.20), then reload skills (`/skills reload` or start a new session).
- **Never edit `.agents/skills/` or `.claude/skills/` directly**: edit only `skills/<area>/<name>/SKILL.md` for authored skills.

---

## 2. Typed IPC Contract Pipeline

Whenever you add, rename, or remove a `#[tauri::command]` in `src-tauri/src/lib.rs`:

```bash
npm run gen:commands      # Regenerates src/api/commands.generated.ts from generate_handler![...]
```

- `src/api/ipc.ts` restricts `invoke()` to names present in `commands.generated.ts`.
- `src-tauri/tests/ipc_contract_test.rs` enforces that every command called by the frontend exists in `generate_handler![...]` and is registered once.

---

## 3. Changelog & Dev Channel Pipeline

Aura-Lune uses **`src/data/changelog.json`** as the **Single Source of Truth** for in-app changelogs, rolling `dev-build` notes, and stable GitHub Releases. The rules live in [`CHANGELOG.md`](../../CHANGELOG.md).

### During active work on `dev`

1. If your change affects listeners (features, fixes, UX, speed, security), humanize the description (plain language, no internal file/function/IPC jargon) and add it to the active `"isDev": true` entry:
   ```bash
   npm run changelog:add -- --type added --en "..." --pl "..." --de "..." --fi "..." --la "..."
   # or: npm run changelog:add -- --stdin < payload.json
   ```
2. Validate the file:
   ```bash
   npm run changelog:validate
   ```
   `scripts/changelog.test.mjs` also runs automatically as part of `npm test` to enforce schema, `"isDev"`/`"isLatest"` invariants, 5-language completeness, and jargon warnings on `isDev`.

### How `dev` vs `stable` builds read `changelog.json`

| Build / Channel | Condition | In-App View (`Updates & Changelog`) | GitHub Releases |
|---|---|---|---|
| **Dev branch build** (`auralune-dev`, `tauri dev`) | `buildInfo.channel === "dev"` or `-dev` version | Shows the `"isDev": true` card with `DEV BUILD` badge at top, plus stable history | Rolling `dev-build` pre-release injects `node scripts/changelog.mjs dev-notes` |
| **Stable release build** (`main`, AUR `auralune-bin`) | `buildInfo.channel === "stable"` | Filters out `"isDev": true` entries completely | `packaging/release-notes.sh` reads `notes`/`codename`/`date` directly from `changelog.json` |

### On release (`/release`)

1. Promote the `isDev` entry to the target SemVer version and codename:
   ```bash
   npm run changelog:promote -- X.Y.Z "Release Codename"
   ```
2. Update badges in `README.md` / `README.pl.md`, then verify release readiness:
   ```bash
   packaging/check-release-content.sh X.Y.Z
   ```

---

## 4. Verification & Quality Gate Pipeline

Run checks **after your final edit** (every stage must pass with 0 errors and 0 warnings):

```bash
# Single command matching CI (7 stages: fmt -> oxlint + vitest -> tsc + vite -> clippy -> cargo test -> smoke -> bash -n)
./tests/run_all_tests.sh --fix
```

Targeted checks during iteration:
- **Rust**: `cargo fmt --all && cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features -- -D warnings && cargo test --workspace -- --test-threads=1`
- **Frontend & Scripts**: `npm run lint && npm run typecheck && npm test` (runs both `src/` and `scripts/*.test.mjs`)
- **Shell**: `bash -n <script>.sh`
- **Sandbox note**: Full GStreamer/PulseAudio audio playback tests and `desktop_smoke_test` require access to a running PulseAudio/PipeWire user socket (`DummyOutput` in headless environments).

---

## 5. CI & Stable Release Pipeline

1. **Continuous Integration (`.github/workflows/ci.yml`)**:
   - Runs `frontend` (`bash -n`, `lint`, `test`, `build`) and `backend-desktop` (`fmt`, `clippy`, headless PulseAudio `cargo test --workspace -- --test-threads=1`, `cargo-deny` advisory check).
   - Pushes to `dev` run `publish-dev-release`, building the `dev` AppImage, attaching `SHA256SUMS`, and publishing the rolling `dev-build` pre-release with `dev-notes` from `changelog.json`.
2. **Stable Release**:
   - **Never tag or push `main` manually.** Run content prep (`packaging/check-release-content.sh X.Y.Z`), then trigger GitHub Actions **Prepare release** (on `dev`) → review/merge PR → **Publish release** (on `main`) → update AUR checksums. See [`docs/RELEASING.md`](../RELEASING.md).
