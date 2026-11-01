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
   - `NDK_HOME=/home/mimi/Android/Sdk/ndk/27.2.12479018`
   - Platformy: `android-34` oraz `android-36`
   - Build-Tools: `34.0.0` lub `36.0.0`
4. **Node.js**: wersja 20+ oraz zależności (`npm install`).

---

## 3. Kompilacja i pakiety APK (Release & Debug)

### Opcja A: Zoptymalizowany pakiet Release APK (~35 MB — Zalecany na telefon)
Pakiet ze zoptymalizowanym kodem, minifikacją i usuniętymi symbolami debug (podpisany kluczem testowym, gotowy do bezpośredniej instalacji):
```bash
JAVA_HOME=/home/mimi/Android/jdk-21 \
ANDROID_HOME=/home/mimi/Android/Sdk \
NDK_HOME=/home/mimi/Android/Sdk/ndk/26.1.10909125 \
npm run tauri -- android build --target aarch64 --apk --ci
```
Lokalizacja pliku `.apk`:
```
apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

### Opcja B: Uniwersalny pakiet Debug (ARM64 telefon + x86_64 emulator)
Zawiera pełne symbole diagnostyczne dla procesorów telefonów (`arm64-v8a`) oraz emulatora PC (`x86_64`):
```bash
JAVA_HOME=/home/mimi/Android/jdk-21 \
ANDROID_HOME=/home/mimi/Android/Sdk \
NDK_HOME=/home/mimi/Android/Sdk/ndk/26.1.10909125 \
npm run tauri -- android build --debug --target aarch64 --target x86_64 --apk --ci
```
Lokalizacja pliku `.apk`:
```
apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

Instalacja na podłączonym urządzeniu lub emulatorze (`adb`):
```bash
adb install -r apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

---

## 4. Konfiguracja i uruchomienie emulatora Androida (KVM)

Na Linuksie (Arch / EndeavourOS / CachyOS) emulator Androida działa z pełną akceleracją sprzętową KVM, osiągając wydajność natywną.

### Krok 1: Sprawdzenie akceleracji sprzętowej KVM
Upewnij się, że moduł KVM jest załadowany:
```bash
ls -la /dev/kvm
# Powinno zwrócić np. crw-rw-rw- lub crw-rw---- root kvm
```
Jeżeli Twój użytkownik nie jest w grupie `kvm`, dodaj go: `sudo usermod -aG kvm $USER`.

### Krok 2: Instalacja pakietu emulatora i obrazu systemu
Uruchom `sdkmanager` (zainstaluje silnik emulatora i oficjalny obraz Android 34 x86_64 z Google APIs):
```bash
JAVA_HOME=/home/mimi/Android/jdk-21 \
ANDROID_HOME=/home/mimi/Android/Sdk \
/home/mimi/Android/Sdk/cmdline-tools/latest/bin/sdkmanager \
  "emulator" \
  "system-images;android-34;google_apis;x86_64"
```

### Krok 3: Utworzenie wirtualnego urządzenia (AVD)
Utwórz urządzenie o nazwie `AuraluneDev` (np. profil Pixel 6):
```bash
JAVA_HOME=/home/mimi/Android/jdk-21 \
ANDROID_HOME=/home/mimi/Android/Sdk \
/home/mimi/Android/Sdk/cmdline-tools/latest/bin/avdmanager create avd \
  -n AuraluneDev \
  -k "system-images;android-34;google_apis;x86_64" \
  -d "pixel_6"
```

### Krok 4: Uruchomienie emulatora
Uruchom emulator z akceleracją GPU hosta:
```bash
/home/mimi/Android/Sdk/emulator/emulator -avd AuraluneDev -gpu host &
```
Poczekaj, aż emulator zakończy start systemu (możesz sprawdzić stan poleceniem: `/home/mimi/Android/Sdk/platform-tools/adb wait-for-device`).

### Krok 5: Zbudowanie APK dla architektury x86_64 i instalacja
Aby aplikacja działała z maksymalną wydajnością bez translacji binarnej, skompiluj pakiet pod `x86_64`:
```bash
JAVA_HOME=/home/mimi/Android/jdk-21 \
ANDROID_HOME=/home/mimi/Android/Sdk \
NDK_HOME=/home/mimi/Android/Sdk/ndk/27.2.12479018 \
npm run tauri -- android build --debug --target x86_64 --ci
```

Następnie zainstaluj na uruchomionym emulatorze:
```bash
/home/mimi/Android/Sdk/platform-tools/adb install -r apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

### Krok 6: Wgranie przykładowej muzyki do pamięci emulatora
Aby w bibliotece od razu pojawiły się utwory:
```bash
/home/mimi/Android/Sdk/platform-tools/adb push tests/fixtures/test_sine_440hz.wav /storage/emulated/0/Music/
/home/mimi/Android/Sdk/platform-tools/adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///storage/emulated/0/Music/test_sine_440hz.wav
```

### Krok 7: Uruchomienie Auralune na emulatorze
```bash
/home/mimi/Android/Sdk/platform-tools/adb shell am start -n com.auralune.player/.MainActivity
```

### ⚡ Szybki skrypt automatyczny (All-in-one)
Dla wygody przygotowano skrypt `scripts/run-android-emulator.sh`, który sprawdza stan emulatora, uruchamia go w tle (jeśli nie działa), oczekuje na boot systemu, instaluje APK i uruchamia podgląd logów:
```bash
./scripts/run-android-emulator.sh
```

---

## 5. Podpisywanie i budowanie wersji produkcyjnej (Release)

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
NDK_HOME=/home/mimi/Android/Sdk/ndk/27.2.12479018 \
npm run tauri -- android build --target aarch64 --ci
```

---

## 5. Zgodność i bezpieczeństwo

1. **Brak zależności od GStreamer na Androidzie**: Wszystkie formaty dekodowane są przez certyfikowany, bezpieczny silnik Symphonia w pamięci procesu.
2. **Uprawnienia**: Aplikacja deklaruje minimalny zestaw uprawnień (`INTERNET`, `READ_MEDIA_AUDIO`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK`).
3. **Zarządzanie zasobami i baterią**: Wstrzymanie odtwarzania lub odłączenie słuchawek zwalnia wątek roboczy i usypia pipeline AAudio.
