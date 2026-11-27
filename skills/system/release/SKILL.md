---
name: release
description: 'Prepare and publish an Aura-Lune release via the dev->main pipeline (npm run release:prepare, push dev & main to auto-publish via ci.yml, and npm run release:aur). Use when the user asks to release, bump the version, prepare vX.Y.Z, merge dev to main for release, or update AUR. Don''t use for ordinary feature commits or for recording a dev change (use npm run changelog:add).'
metadata:
    namespace: system
---
# Cutting an Aura-Lune Release

Full architecture reference: `docs/developer/release-pipeline.md` (overview: `docs/RELEASING.md`, Polish: `docs/RELEASING.pl.md`).

Aura-Lune uses a **local-prepare, push-to-publish** workflow:
1. Run `npm run release:prepare` locally on `dev` (promotes changelog, updates README badges, bumps versions, runs `./tests/run_all_tests.sh --fix`, commits, merges `dev` → `main`, and bumps `dev` to `X.Y.(Z+1)-dev`).
2. Only **after explicit user approval**, run `git push origin main dev` (pushing triggers `.github/workflows/ci.yml` to test, build AppImage + `.deb`, generate `SHA256SUMS`, and publish `vX.Y.Z` from `main` while refreshing `dev-build` from `dev`).
3. Optional post-publish AUR sync: `npm run release:aur -- X.Y.Z`.

Never push, force-push, tag, or run AUR pushes without explicit user confirmation.

## 0. Preconditions

1. Clean `dev` checkout synced with `origin/dev`, and local `main` behind or equal to `dev` (`git status --short` empty).
2. Confirm anything you cannot derive:
   - Target SemVer (`patch`, `minor`, `major`, or explicit `X.Y.Z` — `scripts/release.mjs` recommends `minor` if `changelog[0].added` is non-empty, else `patch`).
   - Release **codename** (English phrase, plus optional `--codename-pl` for the Polish README badge).
3. Ensure `src/data/changelog.json` has a non-empty `isDev: true` entry at index `0` with listener-friendly, humanized text in all 5 locales (`en`, `pl`, `de`, `fi`, `la`) — see `CHANGELOG.md`.

## 1. Dry-run first, then prepare locally

Always run `--dry-run` first to verify version resolution and repo state cleanly:

```bash
npm run release:prepare -- <patch|minor|major|X.Y.Z> --codename "<Codename>" --codename-pl "<Polski Kryptonim>" --dry-run
```

Then run without `--dry-run` (which promotes `changelog.json`, updates `README.md` / `README.pl.md` badges, runs `packaging/bump-version.sh`, runs `packaging/check-release-content.sh ... --strict-versions`, executes `./tests/run_all_tests.sh --fix`, commits on `dev`, merges `--no-ff` into `main`, and commits `chore: start X.Y.(Z+1)-dev` on `dev`):

```bash
npm run release:prepare -- <patch|minor|major|X.Y.Z> --codename "<Codename>" --codename-pl "<Polski Kryptonim>"
```

Use `--pr` instead if GitHub branch protection forbids direct pushes to `main`. Never pass `--push` without explicit user permission.

## 2. Review & Push (requires explicit user yes)

Show the user:
- The promoted changelog summary and `git log --graph --oneline -n 6 main dev`
- Notice that `git push origin main dev` will trigger CI + automatic release publishing for `vX.Y.Z` (and `dev-build` on `dev`).

Only push once the user confirms:

```bash
git push origin main dev
```

## 3. Verify Publication & Sync AUR

1. Monitor GitHub Actions (`gh run list` / *Actions → CI/CD & Release Pipeline*) and inspect `gh release view vX.Y.Z` (`Auralune_X.Y.Z_amd64.AppImage`, `.deb`, and `SHA256SUMS`).
2. Once `vX.Y.Z` is live, ask before updating AUR (`auralune-bin`):
   ```bash
   npm run release:aur -- X.Y.Z
   ```

## Report

Summarize what `release:prepare` prepared (`vX.Y.Z` on `main`, `vX.Y.(Z+1)-dev` on `dev`), exact test results, and whether `git push` / AUR steps were run or await confirmation.
