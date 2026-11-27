#!/usr/bin/env bash
# ==============================================================================
# Auralune (Kitsune Player) 🌸🎧 — Universal Linux Installer
# Supports dual installation channels: Stable (auralune) and Dev (auralune-dev)
# Works across all Linux distributions (Arch, Ubuntu, Debian, Fedora, openSUSE, etc.)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
REPO="Das-Letzte-Kemonomimi/Aura-Lune"
GITHUB_API="https://api.github.com/repos/${REPO}/releases"

# Default base version for fallback
VERSION="2.0.0"
if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/src-tauri/tauri.conf.json" ]]; then
    DETECTED_VER=$(grep -m1 '"version"' "$SCRIPT_DIR/src-tauri/tauri.conf.json" | sed -E 's/.*"version": "([^"]+)".*/\1/' || echo "")
    if [[ -n "$DETECTED_VER" ]]; then
        VERSION="$DETECTED_VER"
    fi
fi

# Determine channel: 'dev' or 'stable'
# Default: 'stable' — Guaranteed safe default for all remote curl invocations on main/master!
CHANNEL="stable"

# 1. Local git repository branch auto-detection (when run from a local clone)
if [[ -n "$SCRIPT_DIR" ]] && command -v git &>/dev/null; then
    CURRENT_GIT_BRANCH=$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [[ "$CURRENT_GIT_BRANCH" == "dev" || "$CURRENT_GIT_BRANCH" == "develop" ]]; then
        CHANNEL="dev"
    elif [[ "$CURRENT_GIT_BRANCH" == "main" || "$CURRENT_GIT_BRANCH" == "master" ]]; then
        CHANNEL="stable"
    fi
fi

# 2. Environment variable override (CHANNEL / AURALUNE_CHANNEL)
if [[ "${AURALUNE_CHANNEL:-}" == "dev" || "${CHANNEL:-}" == "dev" ]]; then
    CHANNEL="dev"
elif [[ "${AURALUNE_CHANNEL:-}" == "stable" || "${CHANNEL:-}" == "stable" ]]; then
    CHANNEL="stable"
fi

# 3. Command-line flags override (--dev or --stable)
for arg in "$@"; do
    case "$arg" in
        --dev)
            CHANNEL="dev"
            ;;
        --stable)
            CHANNEL="stable"
            ;;
    esac
done

# Colors and styling
BOLD="\033[1m"
GREEN="\033[1;32m"
BLUE="\033[1;34m"
PURPLE="\033[1;35m"
CYAN="\033[1;36m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"

# Installation paths in user space (~/.local) — completely rootless!
INSTALL_DIR="${HOME}/.local/bin"
APPS_DIR="${HOME}/.local/share/applications"
ICONS_128_DIR="${HOME}/.local/share/icons/hicolor/128x128/apps"
ICONS_512_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"

if [[ "$CHANNEL" == "dev" ]]; then
    APP_NAME="Auralune (Dev)"
    APP_ID="auralune-dev"
    BIN_NAME="auralune-dev"
    DATA_DIR="${HOME}/.local/share/auralune-dev"
    APPIMAGE_DEST="${DATA_DIR}/auralune-dev.AppImage"
    LAUNCHER_DEST="${INSTALL_DIR}/auralune-dev"
    DESKTOP_DEST="${APPS_DIR}/auralune-dev.desktop"
    ICON_NAME="auralune-dev"
    GITHUB_BRANCH="dev"
    WM_CLASS="auralune-dev"
else
    APP_NAME="Auralune"
    APP_ID="auralune"
    BIN_NAME="auralune"
    DATA_DIR="${HOME}/.local/share/auralune"
    APPIMAGE_DEST="${DATA_DIR}/auralune.AppImage"
    LAUNCHER_DEST="${INSTALL_DIR}/auralune"
    DESKTOP_DEST="${APPS_DIR}/auralune.desktop"
    ICON_NAME="auralune"
    GITHUB_BRANCH="main"
    WM_CLASS="auralune"
fi

# Help function
show_help() {
    echo -e "${PURPLE}🌸 Auralune — Universal Linux Installer${RESET}"
    echo ""
    echo "Usage:"
    echo "  ./install.sh                Install or update Auralune (auto-selects channel based on branch/version)"
    echo "  ./install.sh --dev          Install Auralune Development version (installed alongside stable)"
    echo "  ./install.sh --stable       Force install Stable version"
    echo "  ./install.sh --uninstall    Uninstall current channel"
    echo "  ./install.sh --uninstall --dev     Uninstall only Development version"
    echo "  ./install.sh --uninstall --stable  Uninstall only Stable version"
    echo "  ${BIN_NAME} --uninstall      Same, from the installed launcher (no script needed)"
    echo "  ./install.sh --help         Show this help"
    echo ""
}

# Handle uninstallation
if [[ "${1:-}" == "--uninstall" || "${1:-}" == "-u" || "${2:-}" == "--uninstall" || "${2:-}" == "-u" ]]; then
    echo -e "${PURPLE}🌸 === Uninstalling ${APP_NAME} (${APP_ID}) === 🌸${RESET}"
    rm -rf "$DATA_DIR"
    rm -f "$LAUNCHER_DEST"
    rm -f "$DESKTOP_DEST"
    rm -f "$ICONS_128_DIR/${ICON_NAME}.png"
    rm -f "$ICONS_512_DIR/${ICON_NAME}.png"
    
    if command -v update-desktop-database &>/dev/null; then
        update-desktop-database "$APPS_DIR" 2>/dev/null || true
    fi
    if command -v gtk-update-icon-cache &>/dev/null; then
        gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ ${APP_NAME} has been successfully removed from your system.${RESET}"
    exit 0
fi

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    show_help
    exit 0
fi

echo -e ""
echo -e "${PURPLE}🌸 ========================================================== 🌸${RESET}"
echo -e "${BOLD}      ${APP_NAME} — Universal Linux Installer      ${RESET}"
echo -e "${CYAN}   Channel: ${BOLD}${CHANNEL^^}${RESET}${CYAN} • Version: ${BOLD}v${VERSION}${RESET}${CYAN} • Hi-Res Audio • DSP    ${RESET}"
echo -e "${PURPLE}🌸 ========================================================== 🌸${RESET}"
echo -e ""

# 1. CPU Architecture check
ARCH=$(uname -m)
if [[ "$ARCH" != "x86_64" && "$ARCH" != "amd64" ]]; then
    echo -e "${RED}❌ Error: CPU architecture $ARCH is not supported. Required: x86_64 / amd64.${RESET}"
    exit 1
fi

# 2. Create required directories
mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$APPS_DIR" "$ICONS_128_DIR" "$ICONS_512_DIR"

# 3. Check if local AppImage is available
SOURCE_APPIMAGE=""
if [[ "$CHANNEL" == "dev" ]]; then
    if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/target/release/bundle/appimage/Auralune_${VERSION}_amd64.AppImage" ]]; then
        SOURCE_APPIMAGE="$SCRIPT_DIR/target/release/bundle/appimage/Auralune_${VERSION}_amd64.AppImage"
    elif [[ -n "$SCRIPT_DIR" ]] && ls "$SCRIPT_DIR"/target/release/bundle/appimage/*.AppImage 1>/dev/null 2>&1; then
        SOURCE_APPIMAGE=$(ls -t "$SCRIPT_DIR"/target/release/bundle/appimage/*.AppImage | head -n 1)
    elif ls ./target/release/bundle/appimage/*.AppImage 1>/dev/null 2>&1; then
        SOURCE_APPIMAGE=$(ls -t ./target/release/bundle/appimage/*.AppImage | head -n 1)
    elif [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/target/dist/Auralune-dev-x86_64.AppImage" ]]; then
        SOURCE_APPIMAGE="$SCRIPT_DIR/target/dist/Auralune-dev-x86_64.AppImage"
    elif [[ -f "./target/dist/Auralune-dev-x86_64.AppImage" ]]; then
        SOURCE_APPIMAGE="./target/dist/Auralune-dev-x86_64.AppImage"
    elif [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/Auralune-dev.AppImage" ]]; then
        SOURCE_APPIMAGE="$SCRIPT_DIR/Auralune-dev.AppImage"
    elif [[ -f "./Auralune-dev.AppImage" ]]; then
        SOURCE_APPIMAGE="./Auralune-dev.AppImage"
    fi
else
    if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/target/release/bundle/appimage/Auralune_${VERSION}_amd64.AppImage" ]]; then
        SOURCE_APPIMAGE="$SCRIPT_DIR/target/release/bundle/appimage/Auralune_${VERSION}_amd64.AppImage"
    elif [[ -n "$SCRIPT_DIR" ]] && ls "$SCRIPT_DIR"/target/release/bundle/appimage/*.AppImage 1>/dev/null 2>&1; then
        SOURCE_APPIMAGE=$(ls -t "$SCRIPT_DIR"/target/release/bundle/appimage/*.AppImage | head -n 1)
    elif ls ./target/release/bundle/appimage/*.AppImage 1>/dev/null 2>&1; then
        SOURCE_APPIMAGE=$(ls -t ./target/release/bundle/appimage/*.AppImage | head -n 1)
    elif [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/Auralune.AppImage" ]]; then
        SOURCE_APPIMAGE="$SCRIPT_DIR/Auralune.AppImage"
    elif [[ -f "./Auralune.AppImage" ]]; then
        SOURCE_APPIMAGE="./Auralune.AppImage"
    fi
fi

if [[ -n "$SOURCE_APPIMAGE" ]]; then
    echo -e "${GREEN}📦 Found local AppImage package:${RESET} $SOURCE_APPIMAGE"
    cp "$SOURCE_APPIMAGE" "$APPIMAGE_DEST"
    chmod +x "$APPIMAGE_DEST"
else
    # 4. Download AppImage from GitHub Releases
    echo -e "${BLUE}🔍 Fetching release assets from GitHub (${REPO})...${RESET}"

    DOWNLOAD_URL=""
    if [[ "$CHANNEL" == "dev" ]]; then
        # 1. Fetch release JSON from GitHub API for tag 'dev-build', 'dev' or 'nightly'
        RELEASE_JSON=$(curl -sSf "${GITHUB_API}/tags/dev-build" 2>/dev/null || curl -sSf "${GITHUB_API}/tags/dev" 2>/dev/null || curl -sSf "${GITHUB_API}/tags/nightly" 2>/dev/null || echo "")
        if [[ -n "$RELEASE_JSON" ]]; then
            DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep "browser_download_url" | grep -i "\.AppImage\"" | head -n 1 | cut -d '"' -f 4 || echo "")
        fi

        # 2. Canonical direct asset URL check if API is rate-limited
        if [[ -z "$DOWNLOAD_URL" ]]; then
            DEV_DIRECT_URL="https://github.com/${REPO}/releases/download/dev-build/Auralune-dev-x86_64.AppImage"
            if curl -sIf "$DEV_DIRECT_URL" 2>/dev/null | grep -qiE 'HTTP/.* [23][0-9][0-9]'; then
                DOWNLOAD_URL="$DEV_DIRECT_URL"
            fi
        fi

        # 3. If dev release asset does not exist yet on GitHub, NEVER fall back to stable!
        if [[ -z "$DOWNLOAD_URL" ]]; then
            echo -e "${RED}❌ Error: No development AppImage found on GitHub Releases under tag 'dev-build' or 'dev'.${RESET}"
            echo -e "${YELLOW}💡 A rolling 'dev' pre-release is published automatically once the CI workflow runs on the 'dev' branch.${RESET}"
            echo -e "${YELLOW}   If you have a local build, install it directly with:${RESET}"
            echo -e "     ${BOLD}./install.sh --dev${RESET}"
            echo -e "${YELLOW}   Or compile locally using Tauri:${RESET}"
            echo -e "     ${BOLD}npm run tauri build -- --bundles appimage${RESET}"
            echo -e "     ${BOLD}./install.sh --dev${RESET}"
            exit 1
        fi
    else
        LATEST_JSON=$(curl -sSf "${GITHUB_API}/latest" 2>/dev/null || echo "")
        if [[ -n "$LATEST_JSON" ]]; then
            TAG_NAME=$(echo "$LATEST_JSON" | grep '"tag_name":' | head -n 1 | cut -d '"' -f 4 || echo "v${VERSION}")
            DETECTED_TAG_VER="${TAG_NAME#v}"
            if [[ -n "$DETECTED_TAG_VER" ]]; then
                VERSION="$DETECTED_TAG_VER"
            fi

            DOWNLOAD_URL=$(echo "$LATEST_JSON" | grep "browser_download_url" | grep -i "\.AppImage\"" | head -n 1 | cut -d '"' -f 4 || echo "")
        fi

        if [[ -z "$DOWNLOAD_URL" ]]; then
            DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${VERSION}/Auralune_${VERSION}_amd64.AppImage"
        fi
    fi

    echo -e "${BLUE}⬇️  Downloading ${APP_NAME} AppImage...${RESET}"
    echo -e "${CYAN}   URL: ${DOWNLOAD_URL}${RESET}"
    
    TMP_APPIMAGE=$(mktemp "${DATA_DIR}/${APP_ID}.download.XXXXXX")
    DOWNLOAD_SUCCESS=false
    if command -v curl &>/dev/null; then
        if curl -fLC - --progress-bar -o "$TMP_APPIMAGE" "$DOWNLOAD_URL"; then
            DOWNLOAD_SUCCESS=true
        fi
    elif command -v wget &>/dev/null; then
        if wget --show-progress -q -O "$TMP_APPIMAGE" "$DOWNLOAD_URL"; then
            DOWNLOAD_SUCCESS=true
        fi
    else
        echo -e "${RED}❌ Error: 'curl' or 'wget' is required to download.${RESET}"
        rm -f "$TMP_APPIMAGE"
        exit 1
    fi
    
    if [[ "$DOWNLOAD_SUCCESS" != true || ! -s "$TMP_APPIMAGE" ]]; then
        echo -e "${RED}❌ Error: Failed to download AppImage from: ${DOWNLOAD_URL}${RESET}"
        rm -f "$TMP_APPIMAGE"
        exit 1
    fi

    mv "$TMP_APPIMAGE" "$APPIMAGE_DEST"
    chmod +x "$APPIMAGE_DEST"
fi

# 5. Install smart launcher with FUSE fallback and GStreamer plugin auto-detection
echo -e "${BLUE}⚙️  Configuring ${APP_NAME} launcher (${LAUNCHER_DEST})...${RESET}"
cat > "$LAUNCHER_DEST" <<EOF
#!/usr/bin/env bash
# ${APP_NAME} smart launcher with automatic FUSE 2 fallback and GStreamer plugin detection
APPIMAGE="${APPIMAGE_DEST}"
export AURALUNE_CHANNEL="${CHANNEL}"

# \`${BIN_NAME} --uninstall\` removes this channel's launcher, AppImage, menu entry and icons.
if [ "\${1:-}" = "--uninstall" ]; then
    echo "Uninstalling ${APP_NAME}..."
    rm -rf "${DATA_DIR}"
    rm -f "${DESKTOP_DEST}" "${ICONS_128_DIR}/${ICON_NAME}.png" "${ICONS_512_DIR}/${ICON_NAME}.png"
    command -v update-desktop-database &>/dev/null && update-desktop-database "${APPS_DIR}" 2>/dev/null
    command -v gtk-update-icon-cache &>/dev/null && gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null
    rm -f "${LAUNCHER_DEST}"
    echo "${APP_NAME} has been removed. Your library database and settings were kept."
    exit 0
fi

if [ ! -f "\$APPIMAGE" ]; then
    echo "Error: Could not find ${APP_NAME} AppImage at \$APPIMAGE" >&2
    exit 1
fi

# Ensure host GStreamer plugins are loaded correctly (fixes PipeWire/ALSA on Arch Linux & minimal distros)
if [ -z "\${GST_PLUGIN_SYSTEM_PATH_1_0:-}" ]; then
    for gp in /usr/lib/gstreamer-1.0 /usr/lib64/gstreamer-1.0 /usr/lib/x86_64-linux-gnu/gstreamer-1.0; do
        if [ -d "\$gp" ]; then
            export GST_PLUGIN_SYSTEM_PATH_1_0="\$gp"
            break
        fi
    done
fi

# Check FUSE 2 library
HAS_FUSE=0
if command -v fusermount &>/dev/null && (ldconfig -p 2>/dev/null | grep -q "libfuse\.so\.2" || [ -e /usr/lib/libfuse.so.2 ] || [ -e /usr/lib64/libfuse.so.2 ] || [ -e /usr/lib/x86_64-linux-gnu/libfuse.so.2 ]); then
    HAS_FUSE=1
fi

if [ "\$HAS_FUSE" -eq 1 ]; then
    exec "\$APPIMAGE" "\$@"
else
    if "\$APPIMAGE" --appimage-version &>/dev/null 2>&1; then
        exec "\$APPIMAGE" "\$@"
    else
        exec "\$APPIMAGE" --appimage-extract-and-run "\$@"
    fi
fi
EOF
chmod +x "$LAUNCHER_DEST"

# 6. Install hicolor icons (new "lineout" default; the app re-applies the style chosen in Settings on start)
echo -e "${BLUE}🎨 Installing application icon...${RESET}"
rm -f "$ICONS_128_DIR/${ICON_NAME}.png"
if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/src-tauri/icons/icon_lineout.png" ]]; then
    cp "$SCRIPT_DIR/src-tauri/icons/icon_lineout.png" "$ICONS_512_DIR/${ICON_NAME}.png"
else
    curl -sSf -o "$ICONS_512_DIR/${ICON_NAME}.png" "https://raw.githubusercontent.com/${REPO}/${GITHUB_BRANCH}/src-tauri/icons/icon_lineout.png" 2>/dev/null || true
fi

# 7. Configure desktop entry (.desktop)
echo -e "${BLUE}📑 Creating desktop application shortcut (${DESKTOP_DEST})...${RESET}"
cat > "$DESKTOP_DEST" <<EOF
[Desktop Entry]
Type=Application
Name=${APP_NAME}
GenericName=Music Player
GenericName[en]=Music Player
GenericName[pl]=Odtwarzacz Muzyki
GenericName[de]=Musik-Player
GenericName[fi]=Musiikkisoitin
GenericName[la]=Concentus Lusor
Comment=Kitsune Music Player (Hi-Res Audio, DSP, Anime Aesthetic, PipeWire) [${CHANNEL^^}]
Comment[pl]=Natywny odtwarzacz muzyki z silnikiem DSP, anime aesthetic i obsługą PipeWire [${CHANNEL^^}]
Exec=$LAUNCHER_DEST %U
Icon=${ICON_NAME}
Terminal=false
StartupWMClass=${WM_CLASS}
Categories=AudioVideo;Audio;Player;Music;
MimeType=audio/flac;audio/x-flac;audio/mpeg;audio/ogg;audio/wav;audio/x-wav;audio/aac;audio/mp4;audio/x-m4a;audio/opus;
Keywords=music;player;audio;kitsune;soundtouch;rubberband;pipewire;anime;radio;
EOF
chmod +x "$DESKTOP_DEST"

# 8. Update desktop database and icon cache
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
fi

echo -e ""
echo -e "${GREEN}✨ ========================================================== ✨${RESET}"
echo -e "${BOLD}${GREEN}🎉 ${APP_NAME} v${VERSION} installed successfully!${RESET}"
echo -e "${CYAN}🎧 You can launch the app from your application launcher (${APP_NAME})${RESET}"
echo -e "${CYAN}   or from the terminal with:${RESET} ${BOLD}${BIN_NAME}${RESET}"

# Warning if ~/.local/bin is not in $PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* && ":$PATH:" != *":$HOME/.local/bin"* ]]; then
    echo -e ""
    echo -e "${YELLOW}💡 Note: ~/.local/bin is not in your PATH.${RESET}"
    echo -e "${YELLOW}   To run '${BIN_NAME}' directly from the terminal, add to ~/.bashrc or ~/.zshrc:${RESET}"
    echo -e "   ${BOLD}export PATH=\"\$HOME/.local/bin:\$PATH\"${RESET}"
fi
echo -e "${GREEN}✨ ========================================================== ✨${RESET}"
echo -e ""
