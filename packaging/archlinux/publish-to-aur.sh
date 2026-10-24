#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: Publikacja pakietu auralune-bin na AUR (Arch User Repository)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

AUR_PKG_NAME="auralune-bin"
AUR_REPO_URL="ssh://aur@aur.archlinux.org/${AUR_PKG_NAME}.git"
TEMP_DIR="/tmp/${AUR_PKG_NAME}-aur-sync"

echo "🌸 === Publikacja pakietu $AUR_PKG_NAME na AUR ==="

# 1. Sprawdzenie klucza SSH
if [[ ! -f "$HOME/.ssh/id_ed25519" && ! -f "$HOME/.ssh/id_rsa" ]]; then
    echo "⚠️ Nie znaleziono klucza SSH w ~/.ssh/!"
    echo "Aby publikować na AUR, wygeneruj klucz i dodaj go do konta na https://aur.archlinux.org/account:"
    echo "  ssh-keygen -t ed25519 -C \"twoj_email@domena.com\""
    echo "  cat ~/.ssh/id_ed25519.pub"
    echo ""
fi

# 2. Czyszczenie i klonowanie repozytorium AUR
rm -rf "$TEMP_DIR"
echo "📥 Klonowanie repozytorium AUR: $AUR_REPO_URL..."
if ! git clone "$AUR_REPO_URL" "$TEMP_DIR"; then
    echo "❌ Nie udało się sklonować repozytorium AUR."
    echo "Upewnij się, że masz konto na https://aur.archlinux.org oraz dodany klucz SSH."
    exit 1
fi

# 3. Kopiowanie tylko PKGBUILD i .SRCINFO
echo "📋 Kopiowanie PKGBUILD i .SRCINFO..."
cp "$SCRIPT_DIR/PKGBUILD-bin" "$TEMP_DIR/PKGBUILD"
cp "$SCRIPT_DIR/.SRCINFO" "$TEMP_DIR/.SRCINFO"

cd "$TEMP_DIR"

# 4. Sprawdzenie różnic
if [[ -z $(git status --porcelain) ]]; then
    echo "✨ Brak zmian do wysłania na AUR. Pakiet na AUR jest już aktualny!"
    rm -rf "$TEMP_DIR"
    exit 0
fi

# 5. Wyświetlenie statusu i commit
echo "📝 Przygotowanie zapisu do AUR..."
PKG_VER=$(grep '^pkgver=' PKGBUILD | cut -d= -f2)
git commit -m "Update $AUR_PKG_NAME to $PKG_VER"

echo "🚀 Wypychanie do AUR (master)..."
git push origin master

cd "$WORKSPACE_ROOT"
rm -rf "$TEMP_DIR"

echo "🎉 Sukces! Pakiet $AUR_PKG_NAME został zaktualizowany na AUR:"
echo "👉 https://aur.archlinux.org/packages/$AUR_PKG_NAME"
