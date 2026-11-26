#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: release-notes.sh <X.Y.Z> <codename|date|notes>
#
# Extracts release data from CHANGELOG.md:
#   codename  -> „Codename” without the quotes
#   date      -> YYYY-MM-DD from the heading
#   notes     -> the version block (from the heading to the first `---`)
#
# The heading must have the format:  ## [X.Y.Z] — „Codename” - YYYY-MM-DD
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHANGELOG="${CHANGELOG_FILE:-$SCRIPT_DIR/../CHANGELOG.md}"

VERSION="${1:-}"
FIELD="${2:-}"
if [[ -z "$VERSION" || -z "$FIELD" ]]; then
    echo "Usage: $0 <X.Y.Z> <codename|date|notes>" >&2
    exit 2
fi

heading=$(grep -m1 -F -- "## [$VERSION] — " "$CHANGELOG" || true)
if [[ -z "$heading" ]]; then
    echo "❌ CHANGELOG.md has no heading '## [$VERSION] — „…” - YYYY-MM-DD'." >&2
    exit 1
fi

case "$FIELD" in
    codename)
        sed -E 's/^## \[[^]]*\] — „(.*)” - [0-9]{4}-[0-9]{2}-[0-9]{2}.*$/\1/' <<<"$heading"
        ;;
    date)
        sed -E 's/^.* - ([0-9]{4}-[0-9]{2}-[0-9]{2}).*$/\1/' <<<"$heading"
        ;;
    notes)
        awk -v ver="$VERSION" '
            index($0, "## [" ver "] — ") == 1 { found = 1; next }
            found && /^---/ { exit }
            found { print }
        ' "$CHANGELOG"
        ;;
    *)
        echo "Unknown field: $FIELD (codename|date|notes)" >&2
        exit 2
        ;;
esac
