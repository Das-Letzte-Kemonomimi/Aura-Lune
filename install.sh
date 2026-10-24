#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune (Kitsune Player) 🌸🎧 — Universal Linux Installer
# ==============================================================================

VERSION="0.3.0"
REPO="Das-Letzte-Kemonomimi/Aura-Lune"
PKG_URL="https://github.com/${REPO}/releases/download/v${VERSION}/auralune-bin-${VERSION}-1-x86_64.pkg.tar.zst"
APPIMAGE_URL="https://github.com/${REPO}/releases/download/v${VERSION}/Auralune_${VERSION}_amd64.AppImage"

echo ""
echo "🌸 === Instalator Auralune (Kitsune Player) v${VERSION} === 🌸"
echo ""

ARCH=$(uname -m)
if [[ "$ARCH" != "x86_64" ]]; then
    echo "❌ Błąd: Architektura $ARCH nie jest obecnie wspierana. Wymagane x86_64."
    exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

if command -v pacman &>/dev/null; then
    echo "📦 Wykryto system z menedżerem pacman (Arch / EndeavourOS / CachyOS / Manjaro)."
    echo "⬇️  Pobieranie natywnej paczki auralune-bin-${VERSION}..."
    curl -fLC - --progress-bar -o "$TMP_DIR/auralune-bin.pkg.tar.zst" "$PKG_URL"

    echo "⚙️  Instalowanie paczki w systemie..."
    sudo pacman -U --needed "$TMP_DIR/auralune-bin.pkg.tar.zst"
else
    echo "🐧 Wykryto dystrybucję ogólnolinuksową. Instalacja wersji AppImage..."
    INSTALL_DIR="$HOME/.local/bin"
    APPS_DIR="$HOME/.local/share/applications"
    ICONS_DIR="$HOME/.local/share/icons/hicolor/128x128/apps"

    mkdir -p "$INSTALL_DIR" "$APPS_DIR" "$ICONS_DIR"

    echo "⬇️  Pobieranie Auralune AppImage..."
    curl -fLC - --progress-bar -o "$INSTALL_DIR/auralune" "$APPIMAGE_URL"
    chmod +x "$INSTALL_DIR/auralune"

    echo "🎨 Konfiguracja skrótu na pulpicie..."
    cat > "$APPS_DIR/auralune.desktop" <<EOF
[Desktop Entry]
Name=Auralune
Comment=Native music player for Linux (DSP + Anime aesthetic)
Exec=$INSTALL_DIR/auralune
Icon=auralune
Terminal=false
Type=Application
Categories=AudioVideo;Audio;Player;Music;
Keywords=music;player;audio;kitsune;soundtouch;rubberband;
EOF

    # Pobranie ikony
    curl -sSL -o "$ICONS_DIR/auralune.png" "https://raw.githubusercontent.com/${REPO}/main/apps/desktop/src-tauri/icons/128x128.png"
fi

echo ""
echo "✨ ========================================================== ✨"
echo "🎉 Auralune (Kitsune Player) v${VERSION} zainstalowane pomyślnie!"
echo "🎧 Możesz uruchomić aplikację z menu programów lub poleceniem:"
echo "   auralune"
echo "✨ ========================================================== ✨"
echo ""
