#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: release-notes.sh <X.Y.Z> <codename|date|notes>
#
# Extracts release data from src/data/changelog.json via scripts/changelog.mjs:
#   codename  -> codename for the release
#   date      -> YYYY-MM-DD release date
#   notes     -> clean Markdown release notes (English)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

VERSION="${1:-}"
FIELD="${2:-}"
if [[ -z "$VERSION" || -z "$FIELD" ]]; then
    echo "Usage: $0 <X.Y.Z> <codename|date|notes>" >&2
    exit 2
fi

node "$ROOT_DIR/scripts/changelog.mjs" notes "$VERSION" "$FIELD"
