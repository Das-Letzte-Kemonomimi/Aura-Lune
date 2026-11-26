---
name: release
description: 'Cut an Aura-Lune release: write the release content (CHANGELOG.md, changelog.json, README badges, reset CHANGELOG_PENDING.md) on dev, then drive the manual Prepare release and Publish release GitHub workflows and the AUR checksum. Use when the user asks to release, bump the version, prepare vX.Y.Z, update the AUR package or publish to the public repo. Don''t use for ordinary feature commits or for recording a change in CHANGELOG_PENDING.md.'
metadata:
    namespace: system
---
# Cutting an Aura-Lune release

Stable releases are built and published by **GitHub Actions, only when someone
triggers them by hand**; the full flow, one-time setup and recovery are in
`docs/RELEASING.md` (Polish: `docs/RELEASING.pl.md`). Your part as the agent is
the **content step on `dev`** (sections 0 to 3 below). The version bump itself
is done by the *Prepare release* workflow through `packaging/bump-version.sh`.
Everything outward-facing (push, running a workflow, merging the release PR,
AUR) needs an explicit yes from the user first. Never push, dispatch, merge or
publish on your own.

Past releases to copy the shape of: `git log --oneline --grep='chore(release)'`
(`chore(release): bump version to X.Y.Z (Codename)`, now created by the
workflow) and `chore(aur): update AppImage sha256 checksum for vX.Y.Z`.

## 0. Preconditions

1.  Work from the `dev` checkout with a clean tree: `git status --short` must be
    empty, so the content commit stays reviewable. Note unrelated changes
    (for example `skills-lock.json`) and ask the user whether to
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

## 1. Version bump (done by CI, check locally if you like)

Do **not** edit version numbers by hand for the release: *Prepare release*
runs `packaging/bump-version.sh X.Y.Z`, which rewrites `Cargo.toml`,
`tauri.conf.json`, both `package.json` files and `package-lock.json`,
`install.sh`, `PKGBUILD`/`PKGBUILD-bin`, `.SRCINFO`, `docs/FEATURE_MATRIX.md`
and `DEVELOPMENT.md`, and fails when a file still carries the previous release
(typically the README badge). To rehearse it, run the script in a scratch
`git worktree`, never in the user's checkout. What the script does **not**
write, and you must: the README badges (below) and all changelog content.

`PKGBUILD-git` is never touched (its `pkgver` is generated). `Cargo.lock` is
gitignored.

## 2. Changelog

The source of the wording is `CHANGELOG_PENDING.md` (Polish headings `Dodano`,
`Poprawiono`, `Zmieniono`). Read the "Changelog entries" section of
`docs/developer/frontend-architecture.md` before editing.

1.  **`CHANGELOG.md`**: add `## [X.Y.Z] — „Codename” - YYYY-MM-DD` and
    `**Autorka**: Das Letzte Kemonomimi` above the previous release. Match the
    `[1.1.5]` block exactly: ✨ Dodano, 🛠️ Poprawiono, 🔄 Zmieniono. Keep the
    `---` separator after the block: `packaging/release-notes.sh` extracts the GitHub
    release notes from this heading up to the first `---`, and the codename from
    the heading text between `„` and `”`. A missing separator or a
    changed heading format breaks the release notes.
2.  **`src/data/changelog.json`**: add the new object at the
    **start** of the array, set `isLatest: true` on it and remove `isLatest` from
    the previous one. Do not edit `ChangelogView.tsx` for data. Copy the entry
    shape from the newest existing entries and the `ChangelogRelease` type in
    the frontend (`grep -rn ChangelogRelease src`), because
    the docs and the file have shown different shapes. Provide every
    language the UI ships (currently `pl`, `en`, `de`, `fi`, `la`); the i18n
    parity tests fail on gaps, so also use the `i18n-sync` skill if it applies.
3.  **README badges**: in `README.md` and `README.pl.md` update the version
    badge, the translated codename in its text and the `releases/tag/vX.Y.Z`
    link. The bump script cannot translate the codename, so it only checks that
    the new tag link exists.
4.  **`CHANGELOG_PENDING.md`**: reset to the empty template. Keep the header
    instructions, the `Oczekujące zmiany…` heading and the three empty section
    headings, and drop the old `> Zakres:` note.

## 3. Verify, then commit

1.  `./tests/run_all_tests.sh --fast` (or the full run if code changed).
2.  `packaging/check-release-content.sh X.Y.Z`: the same check the workflows
    run (changelog heading and `---`, 5-language `changelog.json`, empty
    `CHANGELOG_PENDING.md`, README links). Fix everything it prints.
3.  `git diff --stat` and read it: only changelog files, README badges and
    `CHANGELOG_PENDING.md` should differ.
4.  Commit once the user agrees, for example
    `docs(release): changelog and README for X.Y.Z (Codename)`, and ask before
    pushing `dev`.

## 4. Publishing (each step needs an explicit yes)

Tell the user what each step does and wait. Running a workflow is
outward-facing. Use the GitHub UI, or `gh workflow run` if `gh` is installed
and authenticated.

1.  **Push `dev`** (content commit).
2.  **Actions → Prepare release** (branch `dev`, `version` empty or `X.Y.Z`):
    validates, bumps, opens the `release/vX.Y.Z` → `main` PR. If it fails the
    messages say what is missing; fix on `dev` and run again.
3.  **Review and merge the PR with a merge commit** (the user does this).
4.  **Actions → Publish release** (branch `main`): verify, full CI, AppImage
    build, then a draft release with every asset and
    `SHA256SUMS`, published at the end. Suggest `dry_run` first when the
    pipeline itself changed. `SHA256SUMS` is part of the update contract: the
    in-app updater refuses an AppImage it cannot verify.
5.  **AUR**: `packaging/archlinux/update-aur-checksum.sh X.Y.Z` (writes the
    published checksum), commit `chore(aur): update AppImage sha256 checksum
    for vX.Y.Z`, then `packaging/archlinux/publish-to-aur.sh` (needs the user's
    AUR SSH key).
6.  **Next cycle on `dev`** (only if the user asks): `git merge origin/main`,
    `packaging/bump-version.sh X.Y.(Z+1)-dev`.

After publication check `gh release view vX.Y.Z` (or the Releases page) and
report the asset names.

## Report

End with what you changed, what you ran and its result, and which publishing
steps were and were not done. If a step was skipped or failed, say so plainly.
