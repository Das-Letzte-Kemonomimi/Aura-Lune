#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: check-release-content.sh <X.Y.Z> [--strict-versions]
#
# Checks that the release content is ready (promoted changelog + README badges):
#   * changelog.json passes full validation (schema, 5 locales, isDev/isLatest),
#   * entry 0 matches <X.Y.Z> with isLatest=true and isDev != true,
#   * release-notes.sh produces non-empty release notes,
#   * the README badges point at the release tag.
# With --strict-versions, also checks Cargo/npm/Tauri/install.sh/Arch/docs parity
# via `node scripts/release.mjs check <X.Y.Z>`.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

VERSION="${1:-}"
STRICT="${2:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Usage: $0 <X.Y.Z> [--strict-versions]" >&2
    exit 2
fi

fail=0
bad() { echo "❌ $*" >&2; fail=1; }

# changelog.json (Single Source of Truth)
JSON=src/data/changelog.json
if ! node scripts/changelog.mjs validate >/dev/null 2>&1; then
    node scripts/changelog.mjs validate >&2 || true
    bad "$JSON: failed validation (run 'npm run changelog:validate')."
elif ! jq -e --arg v "$VERSION" '.[0].version == $v and .[0].isLatest == true and ((.[0].isDev // false) == false)' "$JSON" >/dev/null 2>&1; then
    bad "$JSON: entry 0 is not promoted to stable version $VERSION with isLatest=true (run 'npm run changelog:promote -- $VERSION \"Codename\"')."
else
    notes=$(packaging/release-notes.sh "$VERSION" notes || true)
    [[ -n "${notes//[[:space:]]/}" ]] || bad "$JSON: release notes for $VERSION are empty."
fi

# README badges
for f in README.md README.pl.md; do
    grep -qF "releases/tag/v$VERSION" "$f" || bad "$f: the version badge does not point at v$VERSION."
done

if [[ "$STRICT" == "--strict-versions" ]]; then
    node scripts/release.mjs check "$VERSION" || fail=1
fi

if (( fail )); then
    echo "" >&2
    echo "Run 'npm run release:prepare' on dev first (see docs/developer/release-pipeline.md)." >&2
    exit 1
fi
echo "✅ Release content for $VERSION is complete."
