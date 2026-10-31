#!/usr/bin/env bash
# ==============================================================================
# Auralune (Kitsune Player) 🌸🎧 — Universal Linux Installer
# Działa na każdej dystrybucji Linuksa (Arch, Ubuntu, Debian, Fedora, openSUSE, etc.)
# ==============================================================================

set -euo pipefail

VERSION="0.7.0"
REPO="Das-Letzte-Kemonomimi/Aura-Lune"
GITHUB_API="https://api.github.com/repos/${REPO}/releases"

# Kolory i ikony
BOLD="\033[1m"
GREEN="\033[1;32m"
BLUE="\033[1;34m"
PURPLE="\033[1;35m"
CYAN="\033[1;36m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"

# Ścieżki instalacji w przestrzeni użytkownika (~/.local) - bez potrzeby uprawnień roota!
INSTALL_DIR="${HOME}/.local/bin"
DATA_DIR="${HOME}/.local/share/auralune"
APPS_DIR="${HOME}/.local/share/applications"
ICONS_128_DIR="${HOME}/.local/share/icons/hicolor/128x128/apps"
ICONS_512_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"
APPIMAGE_DEST="${DATA_DIR}/auralune.AppImage"
LAUNCHER_DEST="${INSTALL_DIR}/auralune"
DESKTOP_DEST="${APPS_DIR}/auralune.desktop"

# Funkcja pomocy
show_help() {
    echo -e "${PURPLE}🌸 Auralune — Universal Linux Installer${RESET}"
    echo ""
    echo "Użycie:"
    echo "  ./install.sh                Zainstaluj lub zaktualizuj Auralune dla bieżącego użytkownika"
    echo "  ./install.sh --uninstall    Odinstaluj Auralune i usuń powiązane skróty"
    echo "  ./install.sh --help         Wyświetl tę pomoc"
    echo ""
}

# Obsługa odinstalowania
if [[ "${1:-}" == "--uninstall" || "${1:-}" == "-u" ]]; then
    echo -e "${PURPLE}🌸 === Odinstalowywanie Auralune (Kitsune Player) === 🌸${RESET}"
    rm -rf "$DATA_DIR"
    rm -f "$LAUNCHER_DEST"
    rm -f "$DESKTOP_DEST"
    rm -f "$ICONS_128_DIR/auralune.png"
    rm -f "$ICONS_512_DIR/auralune.png"
    
    if command -v update-desktop-database &>/dev/null; then
        update-desktop-database "$APPS_DIR" 2>/dev/null || true
    fi
    if command -v gtk-update-icon-cache &>/dev/null; then
        gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Auralune zostało pomyślnie usunięte z systemu.${RESET}"
    exit 0
fi

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    show_help
    exit 0
fi

echo -e ""
echo -e "${PURPLE}🌸 ========================================================== 🌸${RESET}"
echo -e "${BOLD}      Auralune (Kitsune Player) — Universal Linux Installer     ${RESET}"
echo -e "${CYAN}   Hi-Res Audio • Real-Time DSP • PipeWire • Anime Aesthetic    ${RESET}"
echo -e "${PURPLE}🌸 ========================================================== 🌸${RESET}"
echo -e ""

# 1. Weryfikacja architektury CPU
ARCH=$(uname -m)
if [[ "$ARCH" != "x86_64" && "$ARCH" != "amd64" ]]; then
    echo -e "${RED}❌ Błąd: Architektura $ARCH nie jest obecnie wspierana. Wymagane x86_64 / amd64.${RESET}"
    exit 1
fi

# 2. Utworzenie wymaganych katalogów
mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$APPS_DIR" "$ICONS_128_DIR" "$ICONS_512_DIR"

# 3. Sprawdzenie czy lokalny AppImage jest już dostępny (np. w bieżącym katalogu lub target/)
SOURCE_APPIMAGE=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"

if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/target/release/bundle/appimage/Auralune_${VERSION}_amd64.AppImage" ]]; then
    SOURCE_APPIMAGE="$SCRIPT_DIR/target/release/bundle/appimage/Auralune_${VERSION}_amd64.AppImage"
elif [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/Auralune.AppImage" ]]; then
    SOURCE_APPIMAGE="$SCRIPT_DIR/Auralune.AppImage"
elif [[ -f "./Auralune.AppImage" ]]; then
    SOURCE_APPIMAGE="./Auralune.AppImage"
elif [[ -f "./target/release/bundle/appimage/Auralune_${VERSION}_amd64.AppImage" ]]; then
    SOURCE_APPIMAGE="./target/release/bundle/appimage/Auralune_${VERSION}_amd64.AppImage"
fi

if [[ -n "$SOURCE_APPIMAGE" ]]; then
    echo -e "${GREEN}📦 Wykryto lokalną paczkę AppImage:${RESET} $SOURCE_APPIMAGE"
    cp "$SOURCE_APPIMAGE" "$APPIMAGE_DEST"
    chmod +x "$APPIMAGE_DEST"
else
    # 4. Pobieranie najnowszego AppImage z GitHub Releases
    echo -e "${BLUE}🔍 Sprawdzanie najnowszego wydania na GitHubie (${REPO})...${RESET}"
    
    DOWNLOAD_URL=""
    LATEST_JSON=$(curl -sSf "${GITHUB_API}/latest" 2>/dev/null || echo "")
    if [[ -n "$LATEST_JSON" ]]; then
        DOWNLOAD_URL=$(echo "$LATEST_JSON" | grep "browser_download_url" | grep -i "\.AppImage\"" | head -n 1 | cut -d '"' -f 4 || echo "")
        TAG_NAME=$(echo "$LATEST_JSON" | grep '"tag_name":' | head -n 1 | cut -d '"' -f 4 || echo "v${VERSION}")
        echo -e "${CYAN}✨ Wykryto wydanie: ${TAG_NAME}${RESET}"
    fi

    if [[ -z "$DOWNLOAD_URL" ]]; then
        DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${VERSION}/Auralune_${VERSION}_amd64.AppImage"
    fi

    echo -e "${BLUE}⬇️  Pobieranie Auralune AppImage...${RESET}"
    echo -e "${CYAN}   URL: ${DOWNLOAD_URL}${RESET}"
    
    TMP_APPIMAGE=$(mktemp "${DATA_DIR}/auralune.download.XXXXXX")
    if command -v curl &>/dev/null; then
        curl -fLC - --progress-bar -o "$TMP_APPIMAGE" "$DOWNLOAD_URL"
    elif command -v wget &>/dev/null; then
        wget --show-progress -q -O "$TMP_APPIMAGE" "$DOWNLOAD_URL"
    else
        echo -e "${RED}❌ Błąd: Wymagany jest program 'curl' lub 'wget'.${RESET}"
        rm -f "$TMP_APPIMAGE"
        exit 1
    fi
    
    mv "$TMP_APPIMAGE" "$APPIMAGE_DEST"
    chmod +x "$APPIMAGE_DEST"
fi

# 5. Instalacja inteligentnego launchera z obsługą FUSE fallback
echo -e "${BLUE}⚙️  Konfiguracja launchera Auralune (${LAUNCHER_DEST})...${RESET}"
cat > "$LAUNCHER_DEST" <<'EOF'
#!/usr/bin/env bash
# Auralune smart launcher with automatic FUSE 2 fallback
APPIMAGE="$HOME/.local/share/auralune/auralune.AppImage"

if [ ! -f "$APPIMAGE" ]; then
    echo "Błąd: Nie znaleziono pliku Auralune AppImage w $APPIMAGE" >&2
    exit 1
fi

# Sprawdź czy system posiada bibliotekę FUSE 2
HAS_FUSE=0
if command -v fusermount &>/dev/null && (ldconfig -p 2>/dev/null | grep -q "libfuse\.so\.2" || [ -e /usr/lib/libfuse.so.2 ] || [ -e /usr/lib64/libfuse.so.2 ] || [ -e /usr/lib/x86_64-linux-gnu/libfuse.so.2 ]); then
    HAS_FUSE=1
fi

if [ "$HAS_FUSE" -eq 1 ]; then
    exec "$APPIMAGE" "$@"
else
    # Jeśli FUSE nie jest obecny lub zgłasza błąd, uruchom z transparentną ekstrakcją
    if "$APPIMAGE" --appimage-version &>/dev/null 2>&1; then
        exec "$APPIMAGE" "$@"
    else
        exec "$APPIMAGE" --appimage-extract-and-run "$@"
    fi
fi
EOF
chmod +x "$LAUNCHER_DEST"

# 6. Instalacja ikon
echo -e "${BLUE}🎨 Kopiowanie ikon hicolor (128x128 oraz 512x512)...${RESET}"
if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/apps/desktop/src-tauri/icons/128x128.png" ]]; then
    cp "$SCRIPT_DIR/apps/desktop/src-tauri/icons/128x128.png" "$ICONS_128_DIR/auralune.png"
    cp "$SCRIPT_DIR/apps/desktop/src-tauri/icons/icon.png" "$ICONS_512_DIR/auralune.png"
else
    curl -sSf -o "$ICONS_128_DIR/auralune.png" "https://raw.githubusercontent.com/${REPO}/main/apps/desktop/src-tauri/icons/128x128.png" 2>/dev/null || true
    curl -sSf -o "$ICONS_512_DIR/auralune.png" "https://raw.githubusercontent.com/${REPO}/main/apps/desktop/src-tauri/icons/icon.png" 2>/dev/null || true
fi

# 7. Konfiguracja skrótu pulpitu (.desktop)
echo -e "${BLUE}📑 Tworzenie wpisu w menu programów (${DESKTOP_DEST})...${RESET}"
cat > "$DESKTOP_DEST" <<EOF
[Desktop Entry]
Type=Application
Name=Auralune
GenericName=Odtwarzacz Muzyki
GenericName[en]=Music Player
GenericName[pl]=Odtwarzacz Muzyki
GenericName[de]=Musik-Player
GenericName[fi]=Musiikkisoitin
GenericName[la]=Concentus Lusor
Comment=Kitsune Music Player (Hi-Res Audio, DSP, Anime Aesthetic, PipeWire)
Comment[pl]=Natywny odtwarzacz muzyki z silnikiem DSP, anime aesthetic i obsługą PipeWire
Exec=$LAUNCHER_DEST %U
Icon=auralune
Terminal=false
StartupWMClass=auralune
Categories=AudioVideo;Audio;Player;Music;
MimeType=audio/flac;audio/x-flac;audio/mpeg;audio/ogg;audio/wav;audio/x-wav;audio/aac;audio/mp4;audio/x-m4a;audio/opus;
Keywords=music;player;audio;kitsune;soundtouch;rubberband;pipewire;anime;radio;
EOF
chmod +x "$DESKTOP_DEST"

# 8. Aktualizacja bazy pulpitu i pamięci podręcznej ikon
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
fi

echo -e ""
echo -e "${GREEN}✨ ========================================================== ✨${RESET}"
echo -e "${BOLD}${GREEN}🎉 Auralune (Kitsune Player) v${VERSION} zainstalowane pomyślnie!${RESET}"
echo -e "${CYAN}🎧 Możesz uruchomić aplikację z menu programów (skrót Auralune)${RESET}"
echo -e "${CYAN}   lub z konsoli poleceniem:${RESET} ${BOLD}auralune${RESET}"

# Ostrzeżenie jeśli ~/.local/bin nie znajduje się w $PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* && ":$PATH:" != *":$HOME/.local/bin"* ]]; then
    echo -e ""
    echo -e "${YELLOW}💡 Wskazówka: Katalog ~/.local/bin nie znajduje się w Twojej zmiennej PATH.${RESET}"
    echo -e "${YELLOW}   Aby uruchamiać polecenie 'auralune' wprost z terminala, dodaj do ~/.bashrc lub ~/.zshrc:${RESET}"
    echo -e "   ${BOLD}export PATH=\"\$HOME/.local/bin:\$PATH\"${RESET}"
fi
echo -e "${GREEN}✨ ========================================================== ✨${RESET}"
echo -e ""
