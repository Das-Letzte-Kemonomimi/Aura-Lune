#!/usr/bin/env bash
set -e

# Automated smoke test for Auralune
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY="${ROOT_DIR}/target/release/auralune-desktop"

echo "=========================================================="
echo "    AURALUNE (KITSUNE PLAYER): SMOKE TEST"
echo "=========================================================="

FAILED=0

# STEP 1: Check for the release binary
echo -n "[1/6] Checking the release binary... "
if [ -x "$BINARY" ]; then
    echo "OK ($BINARY)"
else
    echo "ERROR: executable $BINARY not found"
    FAILED=$((FAILED + 1))
fi

# STEP 2: Check dynamic dependencies (ldd)
echo -n "[2/6] Checking system library links (ldd)... "
if command -v ldd &> /dev/null && [ -f "$BINARY" ]; then
    MISSING_LIBS=$(ldd "$BINARY" | grep "not found" || true)
    if [ -n "$MISSING_LIBS" ]; then
        echo "WARNING: missing libraries detected:"
        echo "$MISSING_LIBS"
        FAILED=$((FAILED + 1))
    else
        echo "OK (all shared libraries resolved)"
    fi
else
    echo "SKIPPED (ldd unavailable or binary missing)"
fi

# STEP 3: Validate auralune.desktop
echo -n "[3/6] Validating the desktop entry (auralune.desktop)... "
DESKTOP_FILE="${ROOT_DIR}/packaging/auralune.desktop"
if [ -f "$DESKTOP_FILE" ]; then
    if command -v desktop-file-validate &> /dev/null; then
        if desktop-file-validate "$DESKTOP_FILE"; then
            echo "OK (desktop-file-validate passed)"
        else
            echo "ERROR: desktop file validation failed"
            FAILED=$((FAILED + 1))
        fi
    else
        # Basic content check
        if grep -q "Exec=auralune" "$DESKTOP_FILE" && grep -q "Icon=auralune" "$DESKTOP_FILE"; then
            echo "OK (required fields present)"
        else
            echo "ERROR: required fields missing in $DESKTOP_FILE"
            FAILED=$((FAILED + 1))
        fi
    fi
else
    echo "ERROR: $DESKTOP_FILE not found"
    FAILED=$((FAILED + 1))
fi

# STEP 4: Check the app icons
echo -n "[4/6] Checking the app icons... "
ICON_128="${ROOT_DIR}/src-tauri/icons/128x128.png"
ICON_PNG="${ROOT_DIR}/src-tauri/icons/icon.png"
if [ -f "$ICON_128" ] && [ -f "$ICON_PNG" ]; then
    echo "OK (128x128 and 512x512 icons present)"
else
    echo "ERROR: required icon files missing in src-tauri/icons"
    FAILED=$((FAILED + 1))
fi

# STEP 5: Check the AppDir / AppImage structure
echo -n "[5/6] Preparing and checking the AppDir package... "
"${ROOT_DIR}/packaging/appimage/build-appimage.sh" > /dev/null 2>&1
APPDIR="${ROOT_DIR}/target/AppDir"
if [ -x "${APPDIR}/AppRun" ] && [ -x "${APPDIR}/usr/bin/auralune" ] && [ -f "${APPDIR}/auralune.desktop" ]; then
    echo "OK (AppDir structure valid)"
else
    echo "ERROR: incomplete AppDir structure"
    FAILED=$((FAILED + 1))
fi

# STEP 6: Run the backend integration tests (headless smoke test)
echo -n "[6/6] Running the desktop shell integration tests... "
export PATH="$HOME/.cargo/bin:$PATH"
if cargo test -p auralune-desktop --test desktop_smoke_test -- --nocapture > /dev/null 2>&1; then
    echo "OK (desktop_smoke_test passed)"
else
    echo "ERROR while running desktop_smoke_test"
    FAILED=$((FAILED + 1))
fi

echo "=========================================================="
if [ $FAILED -eq 0 ]; then
    echo " RESULT: SMOKE TEST PASSED (0 ERRORS)"
    echo " The package is ready for Linux distribution!"
    echo "=========================================================="
    exit 0
else
    echo " RESULT: SMOKE TEST FAILED ($FAILED ERRORS)"
    echo "=========================================================="
    exit 1
fi
