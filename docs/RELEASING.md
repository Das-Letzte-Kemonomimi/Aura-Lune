# Releasing Auralune

🇬🇧 English | [🇵🇱 Polski](RELEASING.pl.md)

How a stable Auralune release is cut. Stable releases are built and published by GitHub Actions, but **only when you press a button**: merging a pull request never publishes anything.

## 1. Overview

| Channel | Trigger | Result |
|---|---|---|
| **dev** | every push to `dev` (automatic, `ci.yml` → `publish-dev-release`) | rolling pre-release `dev-build`, installs as `auralune-dev` |
| **stable** | two manual workflows (below) | release `vX.Y.Z` with the AppImage and `SHA256SUMS` |

```
dev ──(content step: promote changelog.json, README badges)──▶ push
  │
  ▼  Actions ▸ "Prepare release" ▸ Run workflow            (manual, on dev)
release/vX.Y.Z  =  dev + "chore(release): bump version to X.Y.Z (Codename)"
  │  PR → main
  ▼  you review and merge it (merge commit)                (nothing is published)
main
  │
  ▼  Actions ▸ "Publish release" ▸ Run workflow            (manual, on main)
verify ─┬─ ci (the full ci.yml on this commit) ──┐
        └─ build-appimage ───────────────────────┴─▶ publish (environment "release")
                                                       draft release → all assets → publish
```

## 2. One-time setup

Do this once in the GitHub repository settings.

1. **`RELEASE_TOKEN` secret** (Settings → Secrets and variables → Actions). A fine-grained personal access token limited to this repository with *Contents: Read and write*, *Pull requests: Read and write* and *Administration: Read and write*. It is used for two things that the built-in `GITHUB_TOKEN` cannot do:
   - a pull request opened with `GITHUB_TOKEN` does **not** start CI; one opened with the PAT does;
   - editing the repository description ("About") needs admin rights.

   Without the secret everything still works, but the release PR has no checks and the description is not updated (a warning is shown). In that case also enable *Settings → Actions → General → Allow GitHub Actions to create and approve pull requests*.
2. **`release` environment** (Settings → Environments → New environment). Set *Deployment branches* to `main`. Optionally add yourself as a *Required reviewer*: the publish job then waits for an **Approve** click after all builds are green. That is the final "accept" gate. (If you are the only reviewer, leave *Prevent self-review* off.)
3. **Optional: protect `main`** (require a pull request and the CI checks) so that "merged" really means "reviewed and green".

## 3. Cutting a release, step by step

### 3.1 Content step (on `dev`)

The 5-language changelog is curated during development in `src/data/changelog.json` (`isDev: true`). Before running the workflows (ask the agent: `/release`, or run by hand):

- promote the active `isDev` entry to stable release `X.Y.Z` (`npm run changelog:promote -- X.Y.Z "Codename"`), making sure all items are listener-friendly and translated across all five languages (`en`, `pl`, `de`, `fi`, `la`) with `isLatest: true`;
- update the version badges and `releases/tag/vX.Y.Z` links in `README.md` and `README.pl.md`;
- run `./tests/run_all_tests.sh --fix`, commit and push `dev`.

You can check the result without CI: `packaging/check-release-content.sh X.Y.Z`.

### 3.2 Actions → Prepare release

*Actions → Prepare release → Run workflow*, branch **dev**.

- `version`: leave empty to use the current dev version without `-dev` (`1.1.6-dev` → `1.1.6`), or type `X.Y.Z`.
- It validates the version (semver, newer than the last tag, tag and branch do not exist yet) and the content from step 3.1. Every problem is printed with a clear message and nothing is changed.
- Then it runs `packaging/bump-version.sh`, commits `chore(release): bump version to X.Y.Z (Codename)` on `release/vX.Y.Z` and opens a pull request into `main` with the release notes in the description.

### 3.3 Review and merge

Review the PR (the diff contains only version strings) and wait for the checks. Merge it with a **merge commit**, not a squash, so that `dev` can later be merged with `main` without conflicts. Nothing is published yet.

### 3.4 Actions → Publish release

*Actions → Publish release → Run workflow*, branch **main**.

| Input | Meaning |
|---|---|
| `dry_run` | Build everything but leave the release as a **draft** and do not touch the repository description. Use it when something in the pipeline changed. |

What happens:

1. **verify**: only from `main`; version must be stable (no `-dev`); tag `vX.Y.Z` must not exist; release content must be complete.
2. **ci**: the full `ci.yml` (formatting, clippy, tests, lint, build) on this exact commit.
3. **build-appimage** runs in parallel with CI. The AppImage is built with `AURALUNE_BUILD_CHANNEL=stable` and must be named exactly `Auralune_X.Y.Z_amd64.AppImage` (the name `install.sh`, the AUR package and the updater expect).
4. **publish** (environment `release`, waits for approval if you configured reviewers): creates `SHA256SUMS`, creates the release **as a draft with all assets in one call**, then publishes it (`--latest`) and updates the repository description. Because the draft becomes public only after all assets are uploaded, the in-app updater never sees a release without its checksum.

The run summary shows the checksums and the remaining manual steps.

### 3.5 Check the result

- `gh release view vX.Y.Z` or the *Releases* page: the AppImage and `SHA256SUMS` are present.
- `curl -fsSL https://raw.githubusercontent.com/Das-Letzte-Kemonomimi/Aura-Lune/main/install.sh | bash` installs the new version.
- An older stable install shows the update badge in the app header.

## 4. After the release

1. **AUR** (manual, needs your AUR SSH key). `auralune-bin` unpacks the release AppImage into `/opt/auralune` (bundled libraries included) and adds a `/usr/bin/auralune` launcher, a desktop entry and icons, so `pacman -R auralune-bin` removes it completely. Do this on `dev` or any checkout that has the release:
   ```bash
   packaging/archlinux/update-aur-checksum.sh X.Y.Z   # writes the real AppImage sha256 from the published SHA256SUMS
   git commit -am "chore(aur): update AppImage sha256 checksum for vX.Y.Z"
   packaging/archlinux/publish-to-aur.sh
   ```
2. **Back-merge and start the next cycle on `dev`**:
   ```bash
   git checkout dev && git pull
   git merge origin/main                       # brings the release merge commit back
   packaging/bump-version.sh X.Y.(Z+1)-dev     # touches only Cargo/Tauri/npm files
   git commit -am "chore: start X.Y.(Z+1)-dev"
   git push
   ```

## 5. Dry runs and recovery

- **Rehearsal**: run *Publish release* with `dry_run` on. A draft `vX.Y.Z` is left in *Releases*; inspect the files and delete the draft. The next run also deletes a leftover draft automatically. No tag is created for a draft.
- **A job failed before `publish`**: nothing was released. Fix the cause and run *Publish release* again.
- **The release is wrong after publishing**: `gh release delete vX.Y.Z --yes --cleanup-tag`, fix on `dev`, and start again from *Prepare release* (the old `release/vX.Y.Z` branch must be deleted first).
- **Prepare release created a bad PR**: close it and delete the `release/vX.Y.Z` branch, fix `dev`, run it again.

## 6. Helper scripts

| Script | Purpose |
|---|---|
| `packaging/bump-version.sh <X.Y.Z\|X.Y.Z-dev>` | Rewrites the version in all files (Cargo, Tauri, npm + lockfile, `install.sh`, PKGBUILDs, `.SRCINFO`, docs). A stable bump also checks that README badges were updated; a `-dev` bump touches only the app files. |
| `packaging/check-release-content.sh <X.Y.Z>` | Validates 5-language `changelog.json`, verifies `X.Y.Z` is promoted (`isLatest=true`, not `isDev`), non-empty release notes, and README badges. |
| `packaging/release-notes.sh <X.Y.Z> <codename\|date\|notes>` | Extracts the codename, date or Markdown release notes for a version from `src/data/changelog.json` via `scripts/changelog.mjs`. |
| `packaging/archlinux/update-aur-checksum.sh <X.Y.Z>` | Writes the published AppImage checksum into `PKGBUILD-bin` and `.SRCINFO`. |
| `packaging/archlinux/publish-to-aur.sh` | Pushes `auralune-bin` to the AUR. |

Workflows: `.github/workflows/ci.yml` (quality + rolling dev release, also callable), `release-prepare.yml`, `release-publish.yml`; shared build setup: `.github/actions/setup-build-env`.

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Prepare fails with "changelog.json: failed validation…" or "not promoted…" | The content step (3.1) is missing or incomplete. Run `npm run changelog:promote` / `packaging/check-release-content.sh X.Y.Z` locally. |
| Prepare fails with "leftovers of the previous release" | A file still shows the old version, usually a README badge. Fix it on `dev` and run again. |
| The release PR has no checks | `RELEASE_TOKEN` is missing (PRs opened by `GITHUB_TOKEN` do not start CI). Publish runs the full CI anyway. |
| Publish: "version is not stable" | The release PR was not merged into `main` yet. |
| Publish: "tag already exists" | `vX.Y.Z` was already released. Bump to a new version or delete the release and tag (section 5). |
| Publish: workflow cannot start, "requesting contents: write" | The `ci` job in `release-publish.yml` must keep `permissions: contents: write` (it calls `ci.yml`, which contains the dev publish job). |
| Repository description not updated | `RELEASE_TOKEN` missing or without *Administration* permission. A warning is shown in the log. |
| Publish waits forever | The `release` environment requires approval: open the run and click **Review deployments → Approve**. |
