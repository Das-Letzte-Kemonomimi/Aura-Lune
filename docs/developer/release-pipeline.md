# Release & Dev→Main Merge Pipeline

> **Audience**: Contributors and AI coding agents (`AGENTS.md` links here).
> Related docs: [`agent-pipelines.md`](agent-pipelines.md) (daily workflows), [`CHANGELOG.md`](../../CHANGELOG.md) (changelog rules), [`../RELEASING.md`](../RELEASING.md) (high-level guide).

Aura-Lune uses a **local-prepare, push-to-publish** release architecture:
1. Run one local command on `dev` (`npm run release:prepare`) to validate, promote changelog, rewrite badges, bump all version manifests, run the full verification suite, merge `dev` → `main` cleanly (`--no-ff`), and advance `dev` to the next `-dev` cycle.
2. Simply run **`git push origin main dev`** — GitHub Actions ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) automatically runs CI, builds bundles, generates `SHA256SUMS`, and publishes both channels:
   - **`main` push**: builds `Auralune_X.Y.Z_amd64.AppImage` + `.deb`, publishes GitHub Release `vX.Y.Z` (`--latest`), updates repo description.
   - **`dev` push**: builds `Auralune-dev-x86_64.AppImage`, updates rolling `dev-build` pre-release with unreleased notes from `src/data/changelog.json`.

---

## 1. End-to-End Flow Diagram

```
  dev (1.1.6-dev, humanized "isDev": true notes in src/data/changelog.json)
   │
   ▼  npm run release:prepare -- [patch|minor|major|X.Y.Z] --codename "..."
   ├── Preflight      (clean dev tree, skills:check, non-empty isDev changelog, origin synced)
   ├── Changelog      (npm run changelog:promote -> X.Y.Z, isLatest=true, clear isDev)
   ├── Badges & Bump  (README.md, README.pl.md, packaging/bump-version.sh X.Y.Z)
   ├── Verify         (packaging/check-release-content.sh X.Y.Z --strict-versions + run_all_tests.sh --fix)
   ├── Commit & Merge (commit dev -> merge --no-ff into main -> bump dev to X.Y.(Z+1)-dev)
   │
   ▼  git push origin main dev
   ├──▶ origin/main ──▶ ci.yml (frontend + backend-desktop) ──▶ verify-stable-release ──▶ build (AppImage + .deb) ──▶ publish GitHub Release vX.Y.Z
   └──▶ origin/dev  ──▶ ci.yml (frontend + backend-desktop) ──▶ publish-dev-release  ──▶ rolling dev-build pre-release + dev-notes
```

---

## 2. CLI Commands (`scripts/release.mjs`)

| Command | Purpose |
|---|---|
| `npm run release:prepare -- [spec] --codename "..."` | Runs the complete release preparation & `dev` → `main` merge transaction (`spec` = `patch`, `minor`, `major`, explicit `X.Y.Z`, or omitted/`auto`). |
| `npm run release:check [-- X.Y.Z]` | Offline check verifying `changelog.json` validity plus exact version parity across `Cargo.toml`, `package*.json`, `tauri.conf.json`, `install.sh`, Arch `PKGBUILD*`/`.SRCINFO`, `FEATURE_MATRIX.md`, `DEVELOPMENT.md`, and `README*.md`. |
| `npm run release:aur [-- X.Y.Z]` | Post-publish AUR helper: fetches `SHA256SUMS` from published `vX.Y.Z`, updates `PKGBUILD-bin` + `.SRCINFO`, commits, and runs `publish-to-aur.sh`. |

### Useful `release:prepare` flags

- `--codename "<English Title>"` — Required release codename (also used on GitHub Release title and English README badge).
- `--codename-pl "<Polski Tytuł>"` — Optional localized codename for `README.pl.md` badge (defaults to `--codename`).
- `--next <X.Y.Z-dev>` — Overrides automatic `X.Y.(Z+1)-dev` bump on `dev`.
- `--dry-run` — Previews resolved version, next dev version, and branch plan without touching files or git commits.
- `--pr` — Branch-protection mode: creates `release/vX.Y.Z` instead of merging locally into `main` (`--push` also opens the PR via `gh`).
- `--no-merge` — Only promotes & commits on `dev` without touching `main` or advancing `dev`.
- `--fast` — Passes `--fast` to `./tests/run_all_tests.sh` during preparation (full suite runs by default and always runs on CI).
- `--push` — Automatically pushes branches at the end (off by default so a human always approves outward pushes).

---

## 3. Built-In Safety Guards (CI & Local)

Because pushing to `main` triggers automatic publishing, [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) enforces strict gates before building or creating any release:

1. **No `-dev` leaks on `main`**: `verify-stable-release` fails immediately if `Cargo.toml` on `main` ends in `-dev`.
2. **Idempotent hotfix/doc pushes on `main`**: If tag `vX.Y.Z` already exists on GitHub, `verify-stable-release` sets `should_publish=false` and exits `0` so non-release commits on `main` run CI without attempting duplicate releases.
3. **Monotonic SemVer**: Rejects any version not newer (`sort -V`) than the latest `v*` git tag.
4. **Full parity check**: Runs `packaging/check-release-content.sh X.Y.Z --strict-versions` (all 5 changelog locales, README badges, and manifest/package alignment).
5. **Atomic draft → publish**: Creates `vX.Y.Z` as a draft with all `.AppImage`, `.deb`, and `SHA256SUMS` assets attached in one call, and publishes `--latest` only after uploads succeed (preserving `workflow_dispatch` `dry_run: true` for rehearsals).

---

## 4. Agent Rules for Releases

- **Never push, merge, tag, or publish without explicit user confirmation** (`--push` stays off unless explicitly asked).
- **Never hand-edit version strings across 10 files**: always go through `npm run release:prepare` (or `packaging/bump-version.sh`).
- Use [the `release` skill](../../skills/system/release/SKILL.md) alongside this document whenever cutting a release.
