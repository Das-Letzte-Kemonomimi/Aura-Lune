#!/usr/bin/env bash
set -e

# Builds the AppDir / AppImage package for Auralune
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APPDIR="${ROOT_DIR}/target/AppDir"
OUTPUT_DIR="${ROOT_DIR}/target/dist"

echo "=== [Auralune] Generating AppDir / AppImage ==="

mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${APPDIR}/usr/share/applications"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/128x128/apps"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/512x512/apps"
mkdir -p "${OUTPUT_DIR}"

# 1. Check for the release binary
BINARY="${ROOT_DIR}/target/release/auralune-desktop"
if [ ! -f "$BINARY" ]; then
    echo "No compiled release binary found. Building..."
    export PATH="$HOME/.cargo/bin:$PATH"
    (cd "${ROOT_DIR}" && npx tauri build --no-bundle)
fi

echo "--> Copying the binary into AppDir..."
cp "$BINARY" "${APPDIR}/usr/bin/auralune"
chmod +x "${APPDIR}/usr/bin/auralune"

echo "--> Copying desktop metadata and icons..."
cp "${ROOT_DIR}/packaging/auralune.desktop" "${APPDIR}/usr/share/applications/auralune.desktop"
cp "${ROOT_DIR}/packaging/auralune.desktop" "${APPDIR}/auralune.desktop"

cp "${ROOT_DIR}/src-tauri/icons/128x128.png" "${APPDIR}/usr/share/icons/hicolor/128x128/apps/auralune.png"
cp "${ROOT_DIR}/src-tauri/icons/icon.png" "${APPDIR}/usr/share/icons/hicolor/512x512/apps/auralune.png"
cp "${ROOT_DIR}/src-tauri/icons/128x128.png" "${APPDIR}/auralune.png"

echo "--> Configuring AppRun..."
cp "${ROOT_DIR}/packaging/appimage/AppRun" "${APPDIR}/AppRun"
chmod +x "${APPDIR}/AppRun"

echo "=== AppDir prepared in: ${APPDIR} ==="

# 2. Generate the .AppImage with appimagetool (if available)
if command -v appimagetool &> /dev/null; then
    echo "--> Found appimagetool. Generating Auralune-x86_64.AppImage..."
    ARCH=x86_64 appimagetool "${APPDIR}" "${OUTPUT_DIR}/Auralune-x86_64.AppImage"
    echo "Generated: ${OUTPUT_DIR}/Auralune-x86_64.AppImage"
else
    echo "NOTE: 'appimagetool' is not installed in PATH."
    echo "The AppDir is ready to be packed in ${APPDIR}."
    echo "You can download the official appimagetool or use the AppDir directly."
fi
