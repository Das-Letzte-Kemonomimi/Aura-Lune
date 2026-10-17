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

## Architektura i Etap 0 (Spike techniczny)

- Szczegółowy opis architektury: [`docs/architecture.md`](docs/architecture.md)
- Decyzja architektoniczna DSP: [`docs/adr/0001-dsp-engine-integration.md`](docs/adr/0001-dsp-engine-integration.md)
- Instrukcje agenta i specyfikacja: [`AGENTS.md`](AGENTS.md)

### Uruchomienie Spike'a CLI (Etap 0):
```bash
# Uruchomienie z domyślnym plikiem testowym (440 Hz sinus):
cargo run -p cli-spike

# Lub z własnym plikiem audio:
cargo run -p cli-spike -- /ścieżka/do/utworu.flac
```

---

## Testy i weryfikacja jakości

```bash
# Formatowanie
cargo fmt --check

# Linter (Clippy)
cargo clippy --all-targets --all-features -- -D warnings

# Testy jednostkowe i integracyjne
cargo test --all-features
```

---

## Licencja

Projekt licencjonowany na zasadach **GNU General Public License v3.0 or later** ([`LICENSE`](LICENSE)), zgodnie z wymogami licencyjnymi włączanych komponentów DSP (Rubber Band GPL-2.0-or-later, SoundTouch LGPL-2.1-or-later).
