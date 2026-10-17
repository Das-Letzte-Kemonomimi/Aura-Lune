#!/usr/bin/env bash
set -e

# Skrypt budowania paczki AppDir / AppImage dla Auralune
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APPDIR="${ROOT_DIR}/target/AppDir"
OUTPUT_DIR="${ROOT_DIR}/target/dist"

echo "=== [Auralune] Rozpoczynanie generowania AppDir / AppImage ==="

mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${APPDIR}/usr/share/applications"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/128x128/apps"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/512x512/apps"
mkdir -p "${OUTPUT_DIR}"

# 1. Sprawdzenie obecności pliku binarnego release
BINARY="${ROOT_DIR}/target/release/auralune-desktop"
if [ ! -f "$BINARY" ]; then
    echo "Brak skompilowanego pliku binarnego w trybie release. Kompilacja..."
    export PATH="$HOME/.cargo/bin:$PATH"
    (cd "${ROOT_DIR}/apps/desktop" && npm run build)
    (cd "${ROOT_DIR}" && cargo build --release --locked -p auralune-desktop)
fi

echo "--> Kopiowanie binarki do AppDir..."
cp "$BINARY" "${APPDIR}/usr/bin/auralune"
chmod +x "${APPDIR}/usr/bin/auralune"

echo "--> Kopiowanie metadanych pulpitu i ikon..."
cp "${ROOT_DIR}/packaging/auralune.desktop" "${APPDIR}/usr/share/applications/auralune.desktop"
cp "${ROOT_DIR}/packaging/auralune.desktop" "${APPDIR}/auralune.desktop"

cp "${ROOT_DIR}/apps/desktop/src-tauri/icons/128x128.png" "${APPDIR}/usr/share/icons/hicolor/128x128/apps/auralune.png"
cp "${ROOT_DIR}/apps/desktop/src-tauri/icons/icon.png" "${APPDIR}/usr/share/icons/hicolor/512x512/apps/auralune.png"
cp "${ROOT_DIR}/apps/desktop/src-tauri/icons/128x128.png" "${APPDIR}/auralune.png"

echo "--> Konfiguracja AppRun..."
cp "${ROOT_DIR}/packaging/appimage/AppRun" "${APPDIR}/AppRun"
chmod +x "${APPDIR}/AppRun"

echo "=== AppDir pomyślnie przygotowany w: ${APPDIR} ==="

# 2. Generowanie pliku .AppImage za pomocą appimagetool (jeśli dostępny)
if command -v appimagetool &> /dev/null; then
    echo "--> Wykryto appimagetool w systemie. Generowanie Auralune-x86_64.AppImage..."
    ARCH=x86_64 appimagetool "${APPDIR}" "${OUTPUT_DIR}/Auralune-x86_64.AppImage"
    echo "Pomyślnie wygenerowano: ${OUTPUT_DIR}/Auralune-x86_64.AppImage"
else
    echo "UWAGA: 'appimagetool' nie jest zainstalowany w PATH."
    echo "Katalog AppDir jest gotowy do spakowania w ${APPDIR}."
    echo "Możesz pobrać oficjalny appimagetool lub użyć AppDir bezpośrednio."
fi
