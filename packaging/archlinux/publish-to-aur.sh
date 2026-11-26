#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: publish the auralune-bin package to the AUR (Arch User Repository)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

AUR_PKG_NAME="auralune-bin"
AUR_REPO_URL="ssh://aur@aur.archlinux.org/${AUR_PKG_NAME}.git"
TEMP_DIR="/tmp/${AUR_PKG_NAME}-aur-sync"

echo "🌸 === Publishing $AUR_PKG_NAME to the AUR ==="

# 1. Check for an SSH key
if [[ ! -f "$HOME/.ssh/id_ed25519" && ! -f "$HOME/.ssh/id_rsa" ]]; then
    echo "⚠️ No SSH key found in ~/.ssh/!"
    echo "To publish to the AUR, generate a key and add it to your account at https://aur.archlinux.org/account:"
    echo "  ssh-keygen -t ed25519 -C \"your_email@example.com\""
    echo "  cat ~/.ssh/id_ed25519.pub"
    echo ""
fi

# 2. Clean up and clone the AUR repository
rm -rf "$TEMP_DIR"
echo "📥 Cloning the AUR repository: $AUR_REPO_URL..."
if ! git clone "$AUR_REPO_URL" "$TEMP_DIR"; then
    echo "❌ Could not clone the AUR repository."
    echo "Make sure you have an account on https://aur.archlinux.org and an SSH key added."
    exit 1
fi

# 3. Copy only PKGBUILD and .SRCINFO
echo "📋 Copying PKGBUILD and .SRCINFO..."
cp "$SCRIPT_DIR/PKGBUILD-bin" "$TEMP_DIR/PKGBUILD"
cp "$SCRIPT_DIR/.SRCINFO" "$TEMP_DIR/.SRCINFO"

cd "$TEMP_DIR"

# 4. Check for differences
if [[ -z $(git status --porcelain) ]]; then
    echo "✨ Nothing to push to the AUR. The AUR package is already up to date!"
    rm -rf "$TEMP_DIR"
    exit 0
fi

# 5. Show the status and commit
echo "📝 Preparing the AUR commit..."
git add PKGBUILD .SRCINFO
PKG_VER=$(grep '^pkgver=' PKGBUILD | cut -d= -f2)
git commit -m "Update $AUR_PKG_NAME to $PKG_VER"

echo "🚀 Pushing to the AUR (master)..."
git push origin master

cd "$WORKSPACE_ROOT"
rm -rf "$TEMP_DIR"

echo "🎉 Done! Package $AUR_PKG_NAME was updated on the AUR:"
echo "👉 https://aur.archlinux.org/packages/$AUR_PKG_NAME"
