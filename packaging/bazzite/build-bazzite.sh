#!/usr/bin/env bash
set -e

# Skrypt budowania paczki AppImage dedykowanej dla Bazzite / Fedora
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION=$(grep '^version = ' "${ROOT_DIR}/Cargo.toml" | head -n 1 | cut -d '"' -f 2)
APPDIR="${ROOT_DIR}/target-fedora/AppDir"
OUTPUT_DIR="${ROOT_DIR}/target/dist"
APPIMAGE_NAME="Auralune_${VERSION}_bazzite_amd64.AppImage"

echo "=== [Auralune] Budowanie dedykowanego AppImage dla Bazzite / Fedora (v${VERSION}) ==="

mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${APPDIR}/usr/lib"
mkdir -p "${APPDIR}/usr/share/applications"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/128x128/apps"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/512x512/apps"
mkdir -p "${OUTPUT_DIR}"

# 1. Sprawdzenie obecności pliku binarnego skompilowanego w kontenerze Fedory
BINARY="${ROOT_DIR}/target-fedora/release/auralune-desktop"
if [ ! -f "$BINARY" ]; then
    echo "Brak pliku binarnego target-fedora/release/auralune-desktop. Kompilacja w kontenerze..."
    docker run --rm \
        -v "${ROOT_DIR}:/workspace" \
        -v "${HOME}/.cargo:/root/.cargo" \
        -v "${HOME}/.rustup:/root/.rustup" \
        auralune-bazzite-builder \
        sh -c "export PATH=/root/.cargo/bin:\$PATH && export CARGO_TARGET_DIR=/workspace/target-fedora && cargo build --release -p auralune-desktop"
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

echo "--> Dołączanie wyspecjalizowanych bibliotek DSP (RubberBand, SoundTouch, FFTW3, SampleRate) z Fedory..."
docker run --rm \
    -v "${APPDIR}/usr/lib:/target-lib" \
    auralune-bazzite-builder \
    sh -c "
      cp -P /usr/lib64/librubberband.so* /target-lib/ 2>/dev/null || true
      cp -P /usr/lib64/libSoundTouch.so* /target-lib/ 2>/dev/null || true
      cp -P /usr/lib64/libfftw3.so* /target-lib/ 2>/dev/null || true
      cp -P /usr/lib64/libsamplerate.so* /target-lib/ 2>/dev/null || true
    "

echo "--> Pakowanie do AppImage w kontenerze przy użyciu appimagetool..."
docker run --rm \
    -v "${ROOT_DIR}:/workspace" \
    -e ARCH=x86_64 \
    auralune-bazzite-builder \
    sh -c "
      /usr/local/bin/appimagetool /workspace/target-fedora/AppDir /workspace/target/dist/${APPIMAGE_NAME}
    "

echo "=== Pomyślnie wygenerowano AppImage dla Bazzite: ${OUTPUT_DIR}/${APPIMAGE_NAME} ==="
ls -lh "${OUTPUT_DIR}/${APPIMAGE_NAME}"
