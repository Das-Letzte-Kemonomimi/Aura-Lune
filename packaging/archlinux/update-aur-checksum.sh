#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: update-aur-checksum.sh <X.Y.Z>
#
# Downloads SHA256SUMS of the published GitHub release and writes the AppImage checksum into
# PKGBUILD-bin and .SRCINFO. The checksum therefore always comes from exactly the file
# that was published (no local rebuild).
# Afterwards: commit, then run packaging/archlinux/publish-to-aur.sh.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="Das-Letzte-Kemonomimi/Aura-Lune"

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Usage: $0 <X.Y.Z>" >&2
    exit 2
fi

ASSET="Auralune_${VERSION}_amd64.AppImage"
URL="https://github.com/${REPO}/releases/download/v${VERSION}/SHA256SUMS"

echo "📥 Pobieranie $URL"
SUMS=$(curl -fsSL "$URL") || { echo "❌ Could not download SHA256SUMS (is release v$VERSION published, not a draft?)." >&2; exit 1; }

HASH=$(awk -v a="$ASSET" '$2 == a || $2 == "*" a { print $1 }' <<<"$SUMS")
if [[ ! "$HASH" =~ ^[0-9a-f]{64}$ ]]; then
    echo "❌ SHA256SUMS has no valid checksum for $ASSET." >&2
    exit 1
fi

sed -i -E "s/^sha256sums=\\('[^']*'\\)/sha256sums=('${HASH}')/" "$SCRIPT_DIR/PKGBUILD-bin"
sed -i -E "s/^(\\s*sha256sums = ).*/\\1${HASH}/" "$SCRIPT_DIR/.SRCINFO"

grep -q "$HASH" "$SCRIPT_DIR/PKGBUILD-bin" && grep -q "$HASH" "$SCRIPT_DIR/.SRCINFO" \
    || { echo "❌ Could not write the checksum into PKGBUILD-bin/.SRCINFO." >&2; exit 1; }

echo "✅ $ASSET: $HASH"
echo "ℹ️  Teraz: git commit -am 'chore(aur): update AppImage sha256 checksum for v$VERSION' && packaging/archlinux/publish-to-aur.sh"
