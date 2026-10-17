#!/usr/bin/env bash
set -e

# Skrypt automatycznego testu dymnego (Smoke Test) dla Auralune
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY="${ROOT_DIR}/target/release/auralune-desktop"

echo "=========================================================="
echo "    AURALUNE (KITSUNE PLAYER) — PROCEDURA SMOKE TESTU"
echo "=========================================================="

FAILED=0

# KROK 1: Weryfikacja obecności pliku binarnego release
echo -n "[1/6] Sprawdzanie pliku binarnego release... "
if [ -x "$BINARY" ]; then
    echo "OK ($BINARY)"
else
    echo "BŁĄD: Brak wykonywalnego pliku $BINARY"
    FAILED=$((FAILED + 1))
fi

# KROK 2: Sprawdzanie zależności dynamicznych (ldd)
echo -n "[2/6] Weryfikacja dowiązań bibliotek systemowych (ldd)... "
if command -v ldd &> /dev/null && [ -f "$BINARY" ]; then
    MISSING_LIBS=$(ldd "$BINARY" | grep "not found" || true)
    if [ -n "$MISSING_LIBS" ]; then
        echo "OSTRZEŻENIE: Wykryto brakujące biblioteki:"
        echo "$MISSING_LIBS"
        FAILED=$((FAILED + 1))
    else
        echo "OK (Wszystkie biblioteki współdzielone rozwiązane)"
    fi
else
    echo "POMINIĘTO (ldd niedostępny lub brak binarki)"
fi

# KROK 3: Walidacja pliku auralune.desktop
echo -n "[3/6] Walidacja pliku specyfikacji pulpitu (auralune.desktop)... "
DESKTOP_FILE="${ROOT_DIR}/packaging/auralune.desktop"
if [ -f "$DESKTOP_FILE" ]; then
    if command -v desktop-file-validate &> /dev/null; then
        if desktop-file-validate "$DESKTOP_FILE"; then
            echo "OK (desktop-file-validate zaliczony)"
        else
            echo "BŁĄD walidacji formatu desktop"
            FAILED=$((FAILED + 1))
        fi
    else
        # Prosta walidacja zawartości
        if grep -q "Exec=auralune" "$DESKTOP_FILE" && grep -q "Icon=auralune" "$DESKTOP_FILE"; then
            echo "OK (Podstawowe pola obecne)"
        else
            echo "BŁĄD: Brak wymaganych pól w $DESKTOP_FILE"
            FAILED=$((FAILED + 1))
        fi
    fi
else
    echo "BŁĄD: Brak pliku $DESKTOP_FILE"
    FAILED=$((FAILED + 1))
fi

# KROK 4: Weryfikacja ikon aplikacji
echo -n "[4/6] Weryfikacja kompletności ikon aplikacji... "
ICON_128="${ROOT_DIR}/apps/desktop/src-tauri/icons/128x128.png"
ICON_PNG="${ROOT_DIR}/apps/desktop/src-tauri/icons/icon.png"
if [ -f "$ICON_128" ] && [ -f "$ICON_PNG" ]; then
    echo "OK (Ikony 128x128 i 512x512 obecne)"
else
    echo "BŁĄD: Brak wymaganych plików ikon w src-tauri/icons"
    FAILED=$((FAILED + 1))
fi

# KROK 5: Test struktury AppDir / AppImage
echo -n "[5/6] Przygotowanie i weryfikacja pakietu AppDir... "
"${ROOT_DIR}/packaging/appimage/build-appimage.sh" > /dev/null 2>&1
APPDIR="${ROOT_DIR}/target/AppDir"
if [ -x "${APPDIR}/AppRun" ] && [ -x "${APPDIR}/usr/bin/auralune" ] && [ -f "${APPDIR}/auralune.desktop" ]; then
    echo "OK (Struktura AppDir prawidłowa)"
else
    echo "BŁĄD: Niekompletna struktura AppDir"
    FAILED=$((FAILED + 1))
fi

# KROK 6: Uruchomienie testów integracyjnych backendu (Headless Smoke Test)
echo -n "[6/6] Uruchamianie testów integracyjnych powłoki desktopowej... "
export PATH="$HOME/.cargo/bin:$PATH"
if cargo test -p auralune-desktop --test desktop_smoke_test -- --nocapture > /dev/null 2>&1; then
    echo "OK (Test desktop_smoke_test zaliczony)"
else
    echo "BŁĄD podczas wykonywania desktop_smoke_test"
    FAILED=$((FAILED + 1))
fi

echo "=========================================================="
if [ $FAILED -eq 0 ]; then
    echo " WYNIK: SMOKE TEST ZAKOŃCZONY SUKCESEM (0 BŁĘDÓW)"
    echo " Paczka jest gotowa do dystrybucji na Linuksa!"
    echo "=========================================================="
    exit 0
else
    echo " WYNIK: SMOKE TEST ZAKOŃCZONY NIEPOWODZENIEM ($FAILED BŁĘDÓW)"
    echo "=========================================================="
    exit 1
fi
