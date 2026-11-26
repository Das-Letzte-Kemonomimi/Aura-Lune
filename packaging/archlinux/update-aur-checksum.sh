#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: update-aur-checksum.sh <X.Y.Z>
#
# Pobiera SHA256SUMS opublikowanego wydania GitHub i wpisuje sumę AppImage do
# PKGBUILD-bin oraz .SRCINFO. Dzięki temu suma zawsze pochodzi z dokładnie tego
# pliku, który został opublikowany (bez ponownego budowania lokalnie).
# Po uruchomieniu: zrób commit, potem packaging/archlinux/publish-to-aur.sh.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="Das-Letzte-Kemonomimi/Aura-Lune"

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Użycie: $0 <X.Y.Z>" >&2
    exit 2
fi

ASSET="Auralune_${VERSION}_amd64.AppImage"
URL="https://github.com/${REPO}/releases/download/v${VERSION}/SHA256SUMS"

echo "📥 Pobieranie $URL"
SUMS=$(curl -fsSL "$URL") || { echo "❌ Nie udało się pobrać SHA256SUMS (czy wydanie v$VERSION jest opublikowane, nie szkic?)." >&2; exit 1; }

HASH=$(awk -v a="$ASSET" '$2 == a || $2 == "*" a { print $1 }' <<<"$SUMS")
if [[ ! "$HASH" =~ ^[0-9a-f]{64}$ ]]; then
    echo "❌ SHA256SUMS nie zawiera poprawnej sumy dla $ASSET." >&2
    exit 1
fi

sed -i -E "s/^sha256sums=\\('[^']*'\\)/sha256sums=('${HASH}')/" "$SCRIPT_DIR/PKGBUILD-bin"
sed -i -E "s/^(\\s*sha256sums = ).*/\\1${HASH}/" "$SCRIPT_DIR/.SRCINFO"

grep -q "$HASH" "$SCRIPT_DIR/PKGBUILD-bin" && grep -q "$HASH" "$SCRIPT_DIR/.SRCINFO" \
    || { echo "❌ Nie udało się wpisać sumy do PKGBUILD-bin/.SRCINFO." >&2; exit 1; }

echo "✅ $ASSET: $HASH"
echo "ℹ️  Teraz: git commit -am 'chore(aur): update AppImage sha256 checksum for v$VERSION' && packaging/archlinux/publish-to-aur.sh"
