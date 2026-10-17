# Kitsune Player (Auralune)

Konfigurowalny, zoptymalizowany dla Linuksa odtwarzacz muzyki z silnikiem DSP czasu rzeczywistego (Rubber Band & SoundTouch), bazą SQLite, integracją PipeWire/MPRIS oraz interfejsem desktopowym w estetyce anime.

---

## Wymagania systemowe (Arch / CachyOS / EndeavourOS)

### Pakiety systemowe:
```bash
sudo pacman -S --needed base-devel git rustup \
  gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav gst-plugin-pipewire \
  pipewire soundtouch rubberband
```

---

## Uruchomienie aplikacji desktopowej (Development)

```bash
# 1. Instalacja zależności frontendu:
cd apps/desktop && npm install && cd ../..

# 2. Uruchomienie aplikacji w trybie deweloperskim:
export PATH="$HOME/.cargo/bin:$PATH"
cd apps/desktop
npm run tauri dev
```

---

## Budowanie i pakietowanie (Arch Linux PKGBUILD & AppImage)

### 1. Zautomatyzowany test dymny wydania (Smoke Test):
```bash
./packaging/smoke-test.sh
```

### 2. Budowanie paczki Arch Linux (AUR / pacman):
```bash
cd packaging/archlinux
makepkg -s
sudo pacman -U auralune-*.pkg.tar.zst
```

### 3. Przygotowanie struktury AppDir / AppImage:
```bash
./packaging/appimage/build-appimage.sh
```
Paczka `AppDir` z kompletnym skryptem uruchomieniowym `AppRun`, ikonami i plikiem `.desktop` zostanie wygenerowana w `target/AppDir/`.

---

## Architektura i dokumentacja ADR

- Szczegółowy opis architektury: [`docs/architecture.md`](docs/architecture.md)
- Zestaw decyzji architektonicznych (ADR 0001–0009): [`docs/adr/`](docs/adr/)
- Instrukcje agenta i specyfikacja MVP: [`AGENTS.md`](AGENTS.md)

---

## Testy i weryfikacja jakości

```bash
# Formatowanie
cargo fmt --check

# Linter (Clippy)
cargo clippy --all-targets --all-features -- -D warnings

# Testy jednostkowe i integracyjne (backend)
cargo test --all-features

# Weryfikacja typów i budowanie frontendu
cd apps/desktop && npm run build
```

---

## Licencja

Projekt licencjonowany na zasadach **GNU General Public License v3.0 or later** ([`LICENSE`](LICENSE)), zgodnie z wymogami licencyjnymi włączanych komponentów DSP (Rubber Band GPL-2.0-or-later, SoundTouch LGPL-2.1-or-later).

