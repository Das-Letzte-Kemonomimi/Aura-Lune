# Releasing Auralune

🇬🇧 English | [🇵🇱 Polski](RELEASING.pl.md)

How an Auralune release is prepared locally and published automatically when pushing `main` and `dev`. Detailed CLI & CI architecture for contributors and agents: [`docs/developer/release-pipeline.md`](developer/release-pipeline.md).

## 1. Overview

| Channel | Trigger | Result |
|---|---|---|
| **dev** | Push to `dev` (`.github/workflows/ci.yml` → `publish-dev-release`) | rolling pre-release `dev-build` with dev changelog notes, installs as `auralune-dev` |
| **stable** | Push to `main` (`.github/workflows/ci.yml` → `verify-stable-release` + `build-stable-release` + `publish-stable-release`) | GitHub Release `vX.Y.Z` with `AppImage`, `.deb`, and `SHA256SUMS` (skipped automatically if tag `vX.Y.Z` already exists) |

```
  dev (1.1.6-dev, humanized entries in src/data/changelog.json)
   │
   ▼  npm run release:prepare -- [patch|minor|major|X.Y.Z] --codename "..."
   │    • promotes changelog.json, rewrites README badges, bumps versions
   │    • runs ./tests/run_all_tests.sh --fix & check-release-content.sh --strict-versions
   │    • commits on dev, merges dev ──▶ main (--no-ff), bumps dev to X.Y.(Z+1)-dev
   ▼
  git push origin main dev
   ├──▶ origin/main ──▶ ci.yml ──▶ builds AppImage + .deb + SHA256SUMS ──▶ publishes vX.Y.Z
   └──▶ origin/dev  ──▶ ci.yml ──▶ builds dev AppImage + SHA256SUMS    ──▶ updates dev-build
```

## 2. One-Time GitHub Setup

1. **`RELEASE_TOKEN` secret** (*Settings → Secrets and variables → Actions*, fine-grained PAT with *Contents: Read and write* and *Administration: Read and write*): lets CI update the repository "About" description cleanly when publishing `vX.Y.Z` (without it, everything else still works and a warning is logged).

## 3. Cutting a Release, Step by Step

### 3.1 Prepare locally (`npm run release:prepare`)

Make sure `dev` is clean and `src/data/changelog.json` contains an active `isDev: true` block with listener-friendly, 5-language entries:

```bash
# Preview without touching git or files:
npm run release:prepare -- minor --codename "Harmonic Horizons" --codename-pl "Harmoniczne Horyzonty" --dry-run

# Run full preparation (promotes changelog, updates badges, bumps versions, runs tests, merges to main, bumps next -dev):
npm run release:prepare -- minor --codename "Harmonic Horizons" --codename-pl "Harmoniczne Horyzonty"
```

- Use `--pr` instead if your GitHub repo has branch protection requiring PR reviews on `main` (creates `release/vX.Y.Z` instead of a local `main` merge).

### 3.2 Review and push (`git push`)

Inspect the local commits (`git log --graph --oneline -n 6 main dev`), then push both branches together:

```bash
git push origin main dev
```

No manual GitHub Actions trigger is needed: pushing `main` publishes `vX.Y.Z` once tests pass, and pushing `dev` refreshes `dev-build` for `X.Y.(Z+1)-dev`.

### 3.3 Check the result & sync AUR

- Check *Actions* and *Releases* (`gh release view vX.Y.Z`): `Auralune_X.Y.Z_amd64.AppImage`, `.deb`, and `SHA256SUMS` are present.
- Update the AUR package (`auralune-bin`) once GitHub Release `vX.Y.Z` is live:
  ```bash
  npm run release:aur -- X.Y.Z
  ```

## 4. Dry Runs, Safety Guards & Recovery

- **Safety on `main`**: Pushing a `-dev` version to `main` fails CI immediately. Pushing hotfixes/docs to `main` whose `vX.Y.Z` tag already exists runs CI normally and skips release publishing cleanly.
- **CI dry run**: Run *Actions → CI/CD & Release Pipeline → Run workflow* on `main` with `dry_run: true` to build release bundles and leave `vX.Y.Z` as a draft.
- **Wrong release after publishing**: `gh release delete vX.Y.Z --yes --cleanup-tag`, fix on `dev`, run `npm run release:prepare` again (or re-merge cleanly) and push.

## 5. Helper Commands & Scripts

| Command / Script | Purpose |
|---|---|
| `npm run release:prepare` | Orchestrates changelog promotion, README badges, version bump, full tests, `dev` → `main` merge, and `next-dev` bump (`scripts/release.mjs`). |
| `npm run release:check [X.Y.Z]` | Verifies `changelog.json` + exact version parity across Cargo, npm, Tauri, `install.sh`, Arch files, `FEATURE_MATRIX.md`, `DEVELOPMENT.md`, and `README*.md`. |
| `npm run release:aur [X.Y.Z]` | Downloads `SHA256SUMS` from published `vX.Y.Z`, updates `PKGBUILD-bin` + `.SRCINFO`, commits, and pushes to AUR. |
| `packaging/bump-version.sh <X.Y.Z\|X.Y.Z-dev>` | Rewrites version strings across manifests/packages (or only app manifests for `-dev`). |
| `packaging/check-release-content.sh <X.Y.Z> [--strict-versions]` | Verifies 5-language `changelog.json`, README badges, and optionally full cross-file parity. |
| `packaging/release-notes.sh <X.Y.Z> <codename\|date\|notes>` | Extracts release metadata from `src/data/changelog.json` via `scripts/changelog.mjs`. |
