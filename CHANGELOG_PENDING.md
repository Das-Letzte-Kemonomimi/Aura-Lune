# CHANGELOG_PENDING.md — Rejestr zmian roboczych (Changelog Staging)

> **INSTRUKCJA DLA AGENTA I DEWELOPERÓW:**
> 1. Za każdym razem, gdy wprowadzasz nową funkcję, poprawkę błędu lub refaktor, **musisz dopisać podsumowanie zmiany w odpowiedniej sekcji poniżej**.
> 2. Nie czekaj do momentu wydania — rejestruj zmiany na bieżąco zwięzłym, technicznym opisem.
> 3. Podczas przygotowywania nowego wydania (np. bumpu wersji do kolejnego numeru):
>    - Wszystkie zebrane poniżej punkty są weryfikowane i przenoszone do pliku [`CHANGELOG.md`](./CHANGELOG.md) pod nowym nagłówkiem wersji `## [X.Y.Z] — „Kryptonim” - YYYY-MM-DD`.
>    - Poniższe sekcje są czyszczone do stanu początkowego na kolejny cykl deweloperski.
>    - Nowa wersja jest również dodawana do komponentu [`ChangelogView.tsx`](./apps/desktop/src/components/ChangelogView.tsx).

---

## Oczekujące zmiany na kolejne wydanie (Unreleased / Next Release)

### ✨ Dodano (Added)
- **Port na platformę Android (v0.1.0)**:
  - Dedykowana gałąź `android/v0.1.0` z kompletną obsługą kompilacji APK przez Tauri 2 Mobile.
  - Czysty dekoder Rust Symphonia obsługujący FLAC, MP3, WAV, OGG/Vorbis, AAC/M4A.
  - Zagnieżdżony silnik SoundTouch C++ kompilowany bezpośrednio przez `cc` dla architektury `aarch64`.
  - Natywne wyjście audio Android NDK AAudio o niskiej latencji.
  - Usługa pierwszoplanowa `AuraluneMediaService` z `MediaSession`, sterowaniem na ekranie blokady, powiadomieniem z przyciskami transportu i automatyczną pauzą po odłączeniu słuchawek.
  - Adaptacja interfejsu dotykowego z obsługą Safe Area Insets (`--sat`, `--sab`, `--sal`, `--sar`) oraz powiększonymi celami dotykowymi.
  - Dokumentacja deweloperska i budowania w `docs/android.md` oraz ADR w `docs/adr/0012-android-port.md`.

### 🛠️ Poprawiono (Fixed)
- **Kompatybilność z Androidem 14/15+ i procesorami nowej generacji (Snapdragon 8s Gen 3 / Motorola Edge 50 Ultra)**:
  - **Wyrównanie stron 16 KB (16 KB page sizes)**: Nowe flagowe układy ARMv9 (Cortex-X4/A720) pod kontrolą Androida 15+ wymagają binarnego wyrównania stron pamięci ELF do 16384 bajtów (`0x4000`). Skonfigurowano `-Wl,-z,max-page-size=16384` w `.cargo/config.toml` oraz zaktualizowano zestaw NDK do wersji r27 (`ndk;27.2.12479018`), eliminując błąd linkera systemowego `dlopen failed: has bad ELF alignment`.
  - **Rejestracja odbiornika powiadomień (BroadcastReceiver)**: Dodano flagę `Context.RECEIVER_NOT_EXPORTED` dla zdarzenia `ACTION_AUDIO_BECOMING_NOISY`, wymaganą od Androida 14+ (API 34+).
  - **Usługa pierwszoplanowa (Foreground Service)**: Jawne przekazywanie `ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK` w `startForeground()`.
  - **Symbole C++ SoundTouch na aarch64 oraz x86_64**: Dodano bezwarunkową kompilację `cpu_detect_x86.cpp` (dostarczającego implementację `detectCPUextensions()` dla wszystkich architektur w tym ARM64) oraz `sse_optimized.cpp`/`mmx_optimized.cpp` dla x86_64, eliminując błędy braku symboli `dlopen failed: cannot locate symbol`.
  - **Awaria startowa SQLite i fallback in-memory**: Wprowadzono bezpieczną ścieżkę piaskownicy aplikacji (`/data/data/com.auralune.player/files`) oraz metodę `Database::open_in_memory()` jako ostateczny fallback, eliminując panikę procesu przy braku dostępu do systemu plików na wczesnym etapie startu.
  - **Biblioteki natywne ARM64 i eksport JNI**: Rozwiązano krytyczną przyczynę awarii na telefonie („Auralune keeps stopping”) — pakiet APK zawierał wyłącznie binarki emulatora `x86_64`. Dołączono pełne biblioteki `lib/arm64-v8a` oraz wyeksportowano symbole JNI `MediaBridge` w `cdylib`.
  - **Bezpieczny tracing i obsługa cyklu życia**: Zamieniono panikujący `tracing_subscriber::fmt().init()` na `try_init().ok()`, zabezpieczono `MainActivity.onCreate()` blokami `try/catch` oraz ograniczono desktopowe procedury zasobnika systemowego dyrektywą `#[cfg(desktop)]`.
  - **Zoptymalizowany pakiet Release APK**: Skonfigurowano podpisywanie kluczem debug dla profilu release, generując kompaktowy i zoptymalizowany pakiet `app-universal-release.apk` o rozmiarze ok. 35 MB.
- **Narzędzia developerskie i emulator**:
  - Skonfigurowano oficjalny emulator Android SDK (`system-images;android-34;google_apis;x86_64`) z AVD `AuraluneDev` (Pixel 6) i akceleracją sprzętową KVM.
  - Utworzono automatyczny skrypt pomocniczy `scripts/run-android-emulator.sh` uruchamiający emulator, instalujący APK i monitorujący logi na żywo.

### 🔄 Zmieniono (Changed)
- Warunkowa kompilacja pipeline'u GStreamera oraz modułów integracji desktopowej (MPRIS D-Bus, zasobnik systemowy) dla środowisk nie-linuksowych.

### ⚡ Wydajność i Architektura (Performance & Internal)
- Wprowadzenie generycznej cechy `AudioBackend` w `crates/audio-engine/src/backend.rs`, umożliwiającej czystą separację silnika GStreamer (Linux) od backendu AAudio (Android) bez naruszania logiki domenowej.


