# ADR 0009: Strategia pakietowania i dystrybucji (Arch PKGBUILD, AppImage i Smoke Test)

- **Status**: Zaakceptowany
- **Data**: 2026-10-17
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**: Wymóg MVP: dostarczenie powtarzalnego procesu budowania wydań, oficjalnego przepisu paczki dla dystrybucji Arch/EndeavourOS/CachyOS (PKGBUILD) oraz uniwersalnego formatu dystrybucji Linuksa (AppImage/AppDir), a także procedury zautomatyzowanego testu dymnego (Smoke Test).

---

## 1. Zależności systemowe i separacja bibliotek

1. **Zależności obowiązkowe (Runtime Depends)**:
   - `gstreamer` + `gst-plugins-base` + `gst-plugins-good`: podstawowy pipeline dekodowania i odtwarzania audio.
   - `pipewire`: obsługa grafu audio, urządzeń i profili Pro Audio.
   - `sqlite`: lokalna baza danych metadanych, playlist, presetu i motywów.
   - `webkit2gtk-4.1` / `gtk3` / `glib2`: powłoka GUI Tauri 2 dla Linuksa.
   - `cairo` / `pango` / `openssl`: renderowanie grafiki i bezpieczne żądania sieciowe (MusicBrainz/CAA).
2. **Zależności opcjonalne (Optdepends)**:
   - `gst-plugins-bad`: dekodowanie kontenerów Opus, strumieni AAC/ALAC.
   - `gst-plugin-pipewire`: zoptymalizowany sink PipeWire.
   - `rubberband`: zaawansowany silnik time-stretching i pitch-shifting (GPL-2.0-or-later).
   - `soundtouch`: lekki silnik DSP czasu rzeczywistego (LGPL-2.1-or-later).
   - `bluez-utils`: wykrywanie i przełączanie kodeków Bluetooth A2DP (LDAC, aptX HD, AAC, SBC-XQ).
3. **Zależności czasu budowania (Build Depends)**:
   - `cargo` + `rust` (edycja 2021).
   - `nodejs` + `npm` (React 19 + TypeScript + Vite).
   - `pkgconf` / `pkg-config`.

---

## 2. Architektura pakietów

### A. Paczka Arch Linux (`packaging/archlinux/PKGBUILD`)
- Przygotowana zgodnie ze standardami Arch User Repository (AUR).
- Wieloetapowe budowanie:
  1. `prepare()`: instalacja zależności npm (`npm ci`).
  2. `build()`: kompilacja frontendu (`npm run build`), następnie deterministyczna kompilacja Rust (`cargo build --release --locked -p auralune-desktop`).
  3. `package()`: instalacja binarnego pliku `/usr/bin/auralune`, specyfikacji XDG Desktop `/usr/share/applications/auralune.desktop`, zestawu ikon hicolor oraz licencji GPL-3.0.

### B. Pakiet AppImage / AppDir (`packaging/appimage/`)
- Samodzielna struktura `AppDir` z dedykowanym punktem wejścia `AppRun`.
- Konfiguracja `LD_LIBRARY_PATH` oraz `GST_PLUGIN_SYSTEM_PATH_1_0`.
- Skrypt montujący `build-appimage.sh` przygotowujący obraz i opcjonalnie wywołujący `appimagetool`.

---

## 3. Zautomatyzowana procedura Smoke Testu (`packaging/smoke-test.sh`)

Każde wydanie i paczka weryfikowane są 6-punktowym testem dymnym:
1. Sprawdzenie obecności i praw wykonywalności pliku binarnego release.
2. Sprawdzenie integralności dowiązań dynamicznych (`ldd`) – brak "not found".
3. Walidacja formatu pliku `.desktop` (np. przez `desktop-file-validate`).
4. Weryfikacja obecności ikon zasobów (128x128 i 512x512).
5. Budowa i integralność struktury `AppDir`.
6. Wykonanie bezgłowego testu integracyjnego backendu (`desktop_smoke_test`).
