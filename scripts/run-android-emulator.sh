#!/usr/bin/env bash
# Skrypt do uruchamiania emulatora Androida i instalacji Auralune
set -euo pipefail

export ANDROID_HOME="/home/mimi/Android/Sdk"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
export JAVA_HOME="/home/mimi/Android/jdk-21"

AVD_NAME="AuraluneDev"
APK_PATH="apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk"

echo "📱 Sprawdzanie stanu emulatora / urządzenia..."
if ! adb devices | grep -q "emulator-"; then
    echo "🚀 Uruchamianie emulatora AVD: $AVD_NAME (akceleracja KVM + GPU)..."
    emulator -avd "$AVD_NAME" -gpu host &
fi

echo "⏳ Oczekiwanie na uruchomienie systemu Android..."
adb wait-for-device
while [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]]; do
    sleep 1
done
echo "✅ Emulator wystartował pomyślnie!"

if [[ -f "$APK_PATH" ]]; then
    echo "📦 Instalacja pakietu Auralune APK ($APK_PATH)..."
    adb install -r "$APK_PATH"
    echo "🚀 Uruchamianie Auralune..."
    adb shell am start -n com.auralune.player/.MainActivity
    echo "📋 Podgląd logów aplikacji (Ctrl+C aby przerwać):"
    adb logcat -v time | grep --line-buffered -E "Auralune|RustStdoutStderr|AndroidRuntime|CRASH"
else
    echo "❌ Nie znaleziono pliku $APK_PATH. Najpierw zbuduj pakiet komendą:"
    echo "   npm run tauri -- android build --debug --target x86_64 --ci"
fi
