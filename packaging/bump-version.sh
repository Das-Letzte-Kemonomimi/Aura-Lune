#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: bump-version.sh <X.Y.Z | X.Y.Z-dev>
#
# Mechanically replaces the version number in every file that contains it.
# Used by the "Prepare release" workflow and locally to bump dev to
# the next cycle (e.g. 1.1.7-dev).
#
#  * stable version (X.Y.Z)  -> app files + "latest release" files
#                               (install.sh, PKGBUILD*, .SRCINFO, docs)
#  * dev version (X.Y.Z-dev) -> app files only (Cargo/Tauri/npm); the
#                               "latest release" files keep the released number.
#
# Content (CHANGELOG, changelog.json, README badges) is NOT generated:
# the content step ("/release") does that, and this script only checks it is consistent.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

NEW="${1:-}"
if [[ ! "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-dev)?$ ]]; then
    echo "Usage: $0 <X.Y.Z | X.Y.Z-dev>" >&2
    exit 2
fi

OLD_APP=$(grep -m1 '^version = ' Cargo.toml | cut -d '"' -f 2)
PREV_RELEASE=$(grep -m1 '^pkgver=' packaging/archlinux/PKGBUILD-bin | cut -d= -f2)
[[ -n "$OLD_APP" && -n "$PREV_RELEASE" ]] || { echo "❌ Could not read the current version." >&2; exit 1; }

echo "🔢 App version: $OLD_APP -> $NEW (latest release in the package files: $PREV_RELEASE)"

# --- App files (always) -------------------------------------------------------
sed -i -E '0,/^version = "[^"]*"/s//version = "'"$NEW"'"/' Cargo.toml
sed -i -E '0,/"version": "[^"]*"/s//"version": "'"$NEW"'"/' src-tauri/tauri.conf.json
# package.json + package-lock.json (both "version" lines in the lockfile) in one command.
npm version "$NEW" --no-git-tag-version --allow-same-version >/dev/null

if [[ "$NEW" == *-dev ]]; then
    echo "✅ Dev version: only the app files were changed."
    exit 0
fi

# --- "Latest release" files (stable versions only) ----------------------------
sed -i -E 's/^VERSION="[^"]*"/VERSION="'"$NEW"'"/' install.sh
sed -i -E 's/^pkgver=.*/pkgver='"$NEW"'/' packaging/archlinux/PKGBUILD packaging/archlinux/PKGBUILD-bin
sed -i -E '/^\s*(pkgver|source) = /s/'"${PREV_RELEASE//./\\.}"'/'"$NEW"'/g' packaging/archlinux/.SRCINFO
sed -i -E '1s/\(v[0-9][^)]*\)/(v'"$NEW"')/' docs/FEATURE_MATRIX.md
sed -i -E 's/((Auralune|auralune)_)'"${PREV_RELEASE//./\\.}"'_amd64/\1'"$NEW"'_amd64/g' DEVELOPMENT.md

# --- Consistency check --------------------------------------------------------
fail=0
check_has() { # file pattern description
    grep -qF -- "$2" "$1" || { echo "❌ $1: missing $3 ($2)" >&2; fail=1; }
}
check_has README.md "releases/tag/v$NEW" "version link/badge (add it in the content step)"
check_has README.pl.md "releases/tag/v$NEW" "version link/badge (add it in the content step)"

if [[ "$PREV_RELEASE" != "$NEW" ]]; then
    stale=$(grep -rnF --exclude-dir=node_modules --exclude-dir=target --exclude-dir=target-fedora \
        --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=skills \
        --exclude=package-lock.json --exclude=Cargo.lock --exclude=skills-lock.json \
        --exclude=CHANGELOG.md --exclude=changelog.json --exclude=CHANGELOG_PENDING.md \
        --exclude=PKGBUILD-git --exclude-dir=locales \
        -e "$PREV_RELEASE" \
        install.sh README.md README.pl.md docs/FEATURE_MATRIX.md DEVELOPMENT.md packaging/archlinux \
        2>/dev/null || true)
    if [[ -n "$stale" ]]; then
        echo "❌ Leftovers of the previous release $PREV_RELEASE:" >&2
        echo "$stale" >&2
        fail=1
    fi
fi

if (( fail )); then
    echo "❌ Version bump incomplete: fix the files listed above." >&2
    exit 1
fi
echo "✅ Version $NEW set in every file."
echo "ℹ️  sha256sums in PKGBUILD-bin/.SRCINFO is still the old one: after publishing, run packaging/archlinux/update-aur-checksum.sh $NEW"
