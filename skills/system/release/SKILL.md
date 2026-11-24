---
name: release
description: 'Cut an Aura-Lune release: bump the version in every file that carries it, move CHANGELOG_PENDING.md into CHANGELOG.md and changelog.json, refresh the AUR checksum and sync to the public repository. Use when the user asks to release, bump the version, prepare vX.Y.Z, update the AUR package or publish to the public repo. Don''t use for ordinary feature commits or for recording a change in CHANGELOG_PENDING.md.'
metadata:
    namespace: system
---
# Cutting an Aura-Lune release

A release is two commits of local work (the version bump, then the AUR checksum)
followed by outward-facing steps (force-push to the public repo, GitHub Release,
AUR). Do the local work freely; **stop and get an explicit yes before each
outward-facing step** (see "Publishing"). Never push, tag, upload or publish on
your own.

Past releases to copy the shape of: `git log --oneline --grep='chore(release)'`
(`chore(release): bump version to X.Y.Z (Codename)`), then
`chore(aur): update AppImage sha256 checksum for vX.Y.Z`, then
`release: clean public distribution (vX.Y.Z) …` (made by the sync script).

## 0. Preconditions

1.  Work from the `dev` checkout with a clean tree: `git status --short` must be
    empty (the sync script refuses to run otherwise). Note unrelated changes
    (for example `apps/desktop/skills-lock.json`) and ask the user whether to
    commit or stash them; do not sweep them into the release commit.
2.  Ask for anything you cannot derive: the **new version** (X.Y.Z; SemVer rules
    are at the top of `CHANGELOG.md`: MAJOR = architecture, MINOR = new
    modules/features, PATCH = fixes and polish) and the **codename**
    (`„Kryptonim”`, an English phrase like `Player Dock Harmony & Waveform
    Precision`). The date is today's date, `YYYY-MM-DD`.
3.  Run `./tests/run_all_tests.sh --fix` first. A release is never cut from a red
    tree. Add `--bundle` when the AppImage build changed. Report failures
    verbatim and stop.
4.  `CHANGELOG_PENDING.md` must have real entries. If it is empty, stop and ask.

## 1. Bump the version

The dev branch carries `X.Y.Z-dev` in the files below, so `1.1.6-dev` becomes
`1.1.6`. Grep first, because the list below goes stale:

```bash
grep -rn --exclude-dir=node_modules --exclude-dir=target --exclude-dir=.git \
  --exclude-dir=worktrees --exclude=package-lock.json --exclude=Cargo.lock \
  --exclude=skills-lock.json --exclude=CHANGELOG.md \
  -e 'OLD_VERSION' .
```

Where the version lives (check each, do not assume):

| File | What to change |
| --- | --- |
| `Cargo.toml` | `[workspace.package] version`. All crates inherit it. |
| `apps/desktop/src-tauri/tauri.conf.json` | `"version"`. `install.sh` reads this one. |
| `apps/desktop/package.json` | `"version"` |
| `package.json` (root) | `"version"`. It can lag behind (it was 1.1.5 while dev said 1.1.6-dev); set it to the release version. |
| `install.sh` | fallback `VERSION="…"` near the top |
| `packaging/archlinux/PKGBUILD`, `PKGBUILD-bin` | `pkgver=` |
| `packaging/archlinux/.SRCINFO` | `pkgver =` and the `source =` URL (the version appears twice in the URL) |
| `README.md`, `README.pl.md` | version badge and `releases/tag/vX.Y.Z` link, with the codename in the badge text |
| `docs/FEATURE_MATRIX.md` | version in the first line |
| `DEVELOPMENT.md` | example output paths (`Auralune_X.Y.Z_amd64.AppImage`, `.deb`) |

Leave `PKGBUILD-git` alone (its `pkgver` is generated). `Cargo.lock` is
gitignored; do not try to commit it. `apps/desktop/package-lock.json` carries
the app version near the top: after editing `apps/desktop/package.json` run
`npm --prefix apps/desktop install --package-lock-only` and check that only the
version lines changed in the diff.

## 2. Changelog

The source of the wording is `CHANGELOG_PENDING.md` (Polish headings `Dodano`,
`Poprawiono`, `Zmieniono`). Read the `AGENTS.md` section "How to Record &
Update Changelog Entries" before editing.

1.  **`CHANGELOG.md`**: add `## [X.Y.Z] — „Codename” - YYYY-MM-DD` and
    `**Autorka**: Das Letzte Kemonomimi` above the previous release. Match the
    `[1.1.5]` block exactly: ✨ Dodano, 🛠️ Poprawiono, 🔄 Zmieniono. Keep the
    `---` separator after the block: `sync-public-repo.sh` extracts the GitHub
    release notes with `awk` from this heading up to the first `---`, and takes
    the title from the heading text after `] — `. A missing separator or a
    changed heading format breaks the release notes.
2.  **`apps/desktop/src/data/changelog.json`**: add the new object at the
    **start** of the array, set `isLatest: true` on it and remove `isLatest` from
    the previous one. Do not edit `ChangelogView.tsx` for data. Copy the entry
    shape from the newest existing entries and the `ChangelogRelease` type in
    the frontend (`grep -rn ChangelogRelease apps/desktop/src`), because
    `AGENTS.md` and the file have shown different shapes. Provide every
    language the UI ships (currently `pl`, `en`, `de`, `fi`, `la`); the i18n
    parity tests fail on gaps, so also use the `i18n-sync` skill if it applies.
3.  **`CHANGELOG_PENDING.md`**: reset to the empty template. Keep the header
    instructions, the `Oczekujące zmiany…` heading and the three empty section
    headings, and drop the old `> Zakres:` note.

## 3. Verify, then commit

1.  `./tests/run_all_tests.sh --fast` (or the full run if code changed).
2.  `git diff --stat` and read it: only version strings, changelog files and
    lockfile version lines should differ. Search for leftovers with the grep
    above using the old version; every remaining hit must be intentional (past
    changelog entries, `skills-lock.json`).
3.  Commit once the user agrees: `chore(release): bump version to X.Y.Z (Codename)`.

## 4. Publishing (each step needs an explicit yes)

Tell the user what each step does and wait. These are hard to reverse.

1.  **AppImage + checksum.** The AUR `PKGBUILD-bin` pins a sha256 of the
    released AppImage, which only exists after the build. Build it
    (`cd apps/desktop && npx tauri build --bundles appimage`, output
    `target/release/bundle/appimage/Auralune_X.Y.Z_amd64.AppImage`), run
    `sha256sum` on it, and write the hash into `sha256sums=('…')` in
    `packaging/archlinux/PKGBUILD-bin` and the `sha256sums =` line in
    `.SRCINFO`. The hash must be of the exact file that will be uploaded.
    Commit as `chore(aur): update AppImage sha256 checksum for vX.Y.Z`.
2.  **Public repo + GitHub Release**: `packaging/sync-public-repo.sh`. Tell the
    user what it does first: it recreates a local `release` branch from the
    current branch, removes `AGENTS.md`, **force-pushes** to `public/main`,
    force-moves the tag `vX.Y.Z`, creates or updates the GitHub Release
    (uploading the AppImage, and the Bazzite one from `target/dist/` if present)
    and edits the repository descriptions. It only strips `AGENTS.md`; anything
    else that must not be public (for example `skills/`) is pushed too, so ask
    whether other internal files should be removed first. It needs `gh`
    authenticated.
3.  **AUR**: `packaging/archlinux/publish-to-aur.sh` publishes `auralune-bin`
    (needs an SSH key registered on the AUR). Run it only after the GitHub
    Release exists, since the AppImage URL must resolve.

After the user confirms publication, check
`gh release view vX.Y.Z --repo Das-Letzte-Kemonomimi/Aura-Lune` and report the
asset names. Bump the dev branch to the next cycle (`X.Y.(Z+1)-dev` in the
version files above) only if the user asks.

## Report

End with what you changed, what you ran and its result, and which publishing
steps were and were not done. If a step was skipped or failed, say so plainly.
