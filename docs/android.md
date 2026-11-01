# Instrukcja i Przewodnik Deweloperski: Auralune na Androida

Dokument opisuje architekturę, wymagania środowiskowe, procedurę budowania oraz podpisywania wydań wersji mobilnej Auralune (Kitsune Player) na platformę Android (wersja 0.1.0).

---

## 1. Architektura wydania Android

Wersja dla Androida opiera się na powłoce **Tauri 2 Mobile** oraz natywnym silniku audio w języku **Rust** bezpośrednio zintegrowanym z systemowym interfejsem **Android NDK AAudio**:

```
┌─────────────────────────────────────────────────────────────┐
│                      Android WebView                        │
│         React 18 + TypeScript + Anime Glassmorphism         │
│          Touch Targets (≥44dp) & Safe Area Insets           │
└──────────────────────────────┬──────────────────────────────┘
                               │ IPC / Tauri Commands
┌──────────────────────────────▼──────────────────────────────┐
│                    Rust Domain & Core                       │
│  - Baza danych SQLite (sqlx) dla biblioteki i zakładek       │
│  - Dekoder Symphonia (FLAC, MP3, WAV, OGG, AAC)             │
│  - Analiza tonacji (Camelot Key) i tempa (BPM)              │
│  - DSP: SoundTouch (C++ embedded) [tempo, pitch, rate]      │
│  - Equalizer 10-pasmowy, Reverb, Widener, Crossfeed         │
│  - Obliczanie 16-pasmowego widma FFT dla wizualizera        │
└──────────────┬──────────────────────────────┬───────────────┘
               │ libaaudio.so (NDK)           │ JNI Bridge
┌──────────────▼──────────────┐┌──────────────▼───────────────┐
│        Android AAudio       ││    AuraluneMediaService      │
│  Niskolatencyjny bufor PCM  ││  - MediaSession & Callbacks  │
│    Wątek czasu rzecz.       ││  - Ekran blokady / Bluetooth │
│     Wyjście słuchawkowe     ││  - AudioFocus & Noisy filter │
└─────────────────────────────┘└──────────────────────────────┘
```

Szczegółowe uzasadnienie decyzji architektonicznych znajduje się w dokumencie [docs/adr/0012-android-port.md](file:///home/mimi/Kodowanie/Auralune/docs/adr/0012-android-port.md).

---

## 2. Wymagania systemowe (Prerequisites)

Do zbudowania aplikacji wymagane są:
1. **Rust**: wersja stabilna (`rustup`) z zainstalowanymi celami Androida:
   ```bash
   rustup target add aarch64-linux-android x86_64-linux-android
   ```
2. **Java Development Kit**: JDK 21 (np. Eclipse Temurin):
   ```bash
   export JAVA_HOME=/home/mimi/Android/jdk-21
   ```
3. **Android SDK & NDK**:
   - `ANDROID_HOME=/home/mimi/Android/Sdk`
   - `NDK_HOME=/home/mimi/Android/Sdk/ndk/26.1.10909125`
   - Platformy: `android-34` oraz `android-36`
   - Build-Tools: `34.0.0` lub `36.0.0`
4. **Node.js**: wersja 20+ oraz zależności (`npm install`).

---

## 3. Kompilacja i budowanie (Debug APK)

Aby zbudować wersję debugową dla procesorów ARM64 (`aarch64`):

```bash
JAVA_HOME=/home/mimi/Android/jdk-21 \
ANDROID_HOME=/home/mimi/Android/Sdk \
NDK_HOME=/home/mimi/Android/Sdk/ndk/26.1.10909125 \
npm run tauri -- android build --debug --target aarch64 --ci
```

Wynikowy plik `.apk` jest generowany w:
```
apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

Instalacja na podłączonym urządzeniu lub emulatorze (`adb`):
```bash
adb install -r apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

---

## 4. Podpisywanie i budowanie wersji produkcyjnej (Release)

### Generowanie klucza wydania (Keystore)

Klucz produkcyjny należy wygenerować jednorazowo (nigdy nie umieszczaj pliku `.jks` ani `.keystore` w repozytorium git):

```bash
keytool -genkey -v -keystore release.keystore -alias auralune -keyalg RSA -keysize 2048 -validity 10000
```

### Konfiguracja podpisu

Plik z konfiguracją podpisu tworzy się lokalnie w `apps/desktop/src-tauri/gen/android/keystore.properties` (plik ten jest ignorowany przez `.gitignore`):

```properties
storeFile=/sciezka/do/release.keystore
storePassword=TWOJE_HASLO_KEYSTORE
keyAlias=auralune
keyPassword=TWOJE_HASLO_KLUCZA
```

W pliku `apps/desktop/src-tauri/gen/android/app/build.gradle.kts` można podpiąć `signingConfigs`:
```kotlin
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    ...
    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
            storeFile = file(keystoreProperties.getProperty("storeFile"))
            storePassword = keystoreProperties.getProperty("storePassword")
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

Budowanie wydania produkcyjnego (AAB / APK):
```bash
JAVA_HOME=/home/mimi/Android/jdk-21 \
ANDROID_HOME=/home/mimi/Android/Sdk \
NDK_HOME=/home/mimi/Android/Sdk/ndk/26.1.10909125 \
npm run tauri -- android build --target aarch64 --ci
```

---

## 5. Zgodność i bezpieczeństwo

1. **Brak zależności od GStreamer na Androidzie**: Wszystkie formaty dekodowane są przez certyfikowany, bezpieczny silnik Symphonia w pamięci procesu.
2. **Uprawnienia**: Aplikacja deklaruje minimalny zestaw uprawnień (`INTERNET`, `READ_MEDIA_AUDIO`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK`).
3. **Zarządzanie zasobami i baterią**: Wstrzymanie odtwarzania lub odłączenie słuchawek zwalnia wątek roboczy i usypia pipeline AAudio.
