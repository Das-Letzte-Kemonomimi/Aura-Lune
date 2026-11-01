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
- *(Brak)*

### 🔄 Zmieniono (Changed)
- Warunkowa kompilacja pipeline'u GStreamera oraz modułów integracji desktopowej (MPRIS D-Bus, zasobnik systemowy) dla środowisk nie-linuksowych.

### ⚡ Wydajność i Architektura (Performance & Internal)
- Wprowadzenie generycznej cechy `AudioBackend` w `crates/audio-engine/src/backend.rs`, umożliwiającej czystą separację silnika GStreamer (Linux) od backendu AAudio (Android) bez naruszania logiki domenowej.


