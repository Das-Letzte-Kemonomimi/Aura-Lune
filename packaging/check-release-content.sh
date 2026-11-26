#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: check-release-content.sh <X.Y.Z>
#
# Checks that the release content is ready (the "/release" content step has run):
#   * CHANGELOG.md has a version heading in the right format and non-empty content,
#   * changelog.json: entry at the start of the array, isLatest, all 5 languages,
#   * CHANGELOG_PENDING.md is cleared,
#   * the README badges point at the release tag.
# Used by "Prepare release" and "Publish release". Prints every problem.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Usage: $0 <X.Y.Z>" >&2
    exit 2
fi

fail=0
bad() { echo "❌ $*" >&2; fail=1; }

# CHANGELOG.md
if ! grep -Eq "^## \[${VERSION//./\\.}\] — „.+” - [0-9]{4}-[0-9]{2}-[0-9]{2}\$" CHANGELOG.md; then
    bad "CHANGELOG.md: missing heading '## [$VERSION] — „Codename” - YYYY-MM-DD'."
else
    notes=$(packaging/release-notes.sh "$VERSION" notes)
    [[ -n "${notes//[[:space:]]/}" ]] || bad "CHANGELOG.md: the $VERSION block is empty."
    awk -v ver="$VERSION" '
        index($0, "## [" ver "] — ") == 1 { found = 1; next }
        found && /^---/ { sep = 1; exit }
        END { exit sep ? 0 : 1 }
    ' CHANGELOG.md || bad "CHANGELOG.md: the $VERSION block does not end with a '---' separator (the release notes would be cut off)."
fi

# changelog.json
JSON=src/data/changelog.json
if ! jq -e --arg v "$VERSION" '.[0].version == $v and .[0].isLatest == true' "$JSON" >/dev/null 2>&1; then
    bad "$JSON: the first entry is not version $VERSION with isLatest=true."
else
    jq -e '[.[1:][] | select(.isLatest == true)] | length == 0' "$JSON" >/dev/null \
        || bad "$JSON: older entries still have isLatest=true."
    jq -e '[.[0].added[], .[0].fixed[]] | length > 0' "$JSON" >/dev/null \
        || bad "$JSON: entry $VERSION has no items."
    jq -e '[.[0].added[], .[0].fixed[]] | all(has("pl") and has("en") and has("de") and has("fi") and has("la"))' "$JSON" >/dev/null \
        || bad "$JSON: the items of entry $VERSION do not have every language (pl, en, de, fi, la)."
fi

# CHANGELOG_PENDING.md: after a release only the empty section headings remain
if sed -n '/^## Oczekujące zmiany/,$p' CHANGELOG_PENDING.md | grep -Eq '^\s*([-*]|[0-9]+\.|####) '; then
    bad "CHANGELOG_PENDING.md: still has entries: move them to CHANGELOG.md and clear the template."
fi

# README
for f in README.md README.pl.md; do
    grep -qF "releases/tag/v$VERSION" "$f" || bad "$f: the version badge does not point at v$VERSION."
done

if (( fail )); then
    echo "" >&2
    echo "Run the release content step first (the /release skill, see docs/RELEASING.md)." >&2
    exit 1
fi
echo "✅ Release content for $VERSION is complete."
