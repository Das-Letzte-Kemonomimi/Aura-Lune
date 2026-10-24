<div align="center">
  <p>
    <strong>🇬🇧 English</strong> &nbsp;|&nbsp; <a href="README.pl.md">🇵🇱 Polski</a>
  </p>
  <img src="apps/desktop/src-tauri/icons/128x128.png" alt="Auralune Logo" width="112" height="112" />
  <h1>Auralune (Kitsune Player) 🌸🎧</h1>
  <p><strong>A native, deeply customizable Linux music player marrying the ergonomics of Poweramp, the flexibility of foobar2000, swappable real-time DSP engines, and an anime glassmorphism aesthetic.</strong></p>

  <p>
    <a href="https://github.com/Das-Letzte-Kemonomimi/Aura-Lune/releases/tag/v0.3.0"><img src="https://img.shields.io/badge/version-0.3.0_“Omniscience_%26_Starlight”-f43f5e.svg?style=for-the-badge" alt="Version" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--or--later-a855f7.svg?style=for-the-badge" alt="License" /></a>
    <a href="#"><img src="https://img.shields.io/badge/platform-Linux_%7C_Wayland_%7C_X11-06b6d4.svg?style=for-the-badge" alt="Platform" /></a>
    <a href="#"><img src="https://img.shields.io/badge/backend-Rust_%7C_Tauri_2-fb923c.svg?style=for-the-badge" alt="Rust Tauri 2" /></a>
    <a href="#"><img src="https://img.shields.io/badge/audio-PipeWire_%7C_GStreamer-3b82f6.svg?style=for-the-badge" alt="PipeWire GStreamer" /></a>
  </p>
</div>

---

## 🌟 About The Project

**Auralune** (working title *Kitsune Player*) is a modern desktop music player built natively for Linux. Designed for audiophiles, sound-sculpting tinkerers, and enthusiasts of refined anime aesthetics and acrylic glassmorphism.

The application combines a high-performance **Rust** pipeline with a responsive **React + TypeScript + Vite** frontend, strictly isolating the real-time audio thread from the user interface and background operations.

---

## ✨ Key Features

### 🎛️ Advanced Real-Time DSP Processor
- **Independent Parameter Control**:
  - **Tempo**: Adjust tempo smoothly from 0.15x to 4.00x without altering pitch.
  - **Pitch**: Transpose key in semitones (`-12.0 st` to `+12.0 st`) with cent-level precision.
  - **Playback Rate**: Simultaneous analog-style tempo and pitch scaling.
- **Swappable DSP Engines**:
  - **Rubber Band**: Studio-grade phase vocoder, vocal formant preservation, high-fidelity time stretching.
  - **SoundTouch**: Ultra-low CPU overhead, instant real-time responsiveness.
- **On-The-Fly Seamless Switching**: Switch DSP engines live during playback without dropouts, underruns, or clicks.
- **DSP Presets**: Save and recall pitch and tempo profiles globally, per album, or per track.

### 🔊 Pro Audio Architecture & Linux Native
- **PipeWire & GStreamer**: Direct low-latency output to PipeWire with adaptive ring buffering and graceful ALSA/PulseAudio fallback.
- **Lossless FLAC & Hi-Res Support**: Rock-solid decoding and stutter-free streaming of 24-bit/96kHz+ FLAC, WAV, Opus, Ogg Vorbis, MP3, and AAC/M4A.
- **Bluetooth Pro Audio Codecs**: Dynamic codec negotiation for high-definition wireless listening (LDAC, aptX HD, AAC, SBC-XQ).
- **MPRIS (D-Bus) Desktop Integration**: Seamless integration with KDE Plasma, GNOME, Waybar/Polybar, and hardware media keys.

### 🌸 Anime Aesthetics & Theming Engine
- **Acrylic Glassmorphism**: Translucent user interface with adjustable background blur intensity and backdrop overlay tint.
- **Custom Anime Backgrounds**: Use any local wallpaper while preserving crisp text contrast and readability.
- **Dynamic Neon Sliders**: Vibrant gradient progress fill (`accent-pink` → `accent-purple`) tracking elapsed track time.
- **Anime Ambience FX**: Optional animated background particle effects (falling sakura petals, glowing fireflies, rain, snow).

### 📊 Audio Visualization, Acoustics & Lyrics
- **10-Band Graphic Equalizer**: Precise tone shaping across 31 Hz to 16 kHz.
- **Real-Time FFT Visualizer**: 16-bar animated audio frequency spectrum visualizer.
- **Key & BPM Detection**: Acoustic harmonic analysis (Camelot Wheel / Major & Minor) and tempo estimation.
- **Interactive Waveform Canvas**: High-resolution waveform generation with clickable precision scrubbing.
- **Synchronized LRC Lyrics**: Integrated lyrics viewer with auto-scroll and active line highlighting.

### ⏱️ Player Tools
- **A-B Looper**: Seamlessly loop any track segment with millisecond precision.
- **Playback Bookmarks**: Save exact positions in tracks for 1-click resumption.
- **Flexible Sleep Timer**: Timed shutdown with quick presets, interactive slider, manual minute entry (1–720 min), and gentle volume fade-out.
- **Mini-Player (PiP)**: Compact floating Picture-in-Picture window.
- **Big Screen Mode**: Fullscreen theater view featuring enlarged album artwork, waveform, and subtle playback badges.

---

## 💖 Author & Related Projects

| Project | Description | Link |
| :--- | :--- | :--- |
| **🎵 Das Letzte Kemonomimi** | Original music by the creator of Auralune (including the official test track *“Skrzydła Białe”*, folk-rock / anime soundtrack). Listen and support independent music! | [**Visit Bandcamp**](https://dasletztekemonomimi.bandcamp.com/) |
| **🧠 Sorta (AuDHD Focus)** | Web application designed specifically for people with **AuDHD & ADHD**. Breaks through executive dysfunction and task paralysis into stress-free micro-steps, declutters mental chaos, and provides gentle, empathetic accountability without overwhelm. | [**Try Sorta App**](https://sortaofficial.lovable.app/) |

---

## 📦 Installation & Usage

### 1. Prebuilt AppImage (Any Linux Distribution)
Download the latest standalone executable from **[GitHub Releases](https://github.com/Das-Letzte-Kemonomimi/Aura-Lune/releases/latest)**:
```bash
chmod +x Auralune_0.3.0_amd64.AppImage
./Auralune_0.3.0_amd64.AppImage
```

### 2. Arch Linux / EndeavourOS / CachyOS (AUR)
```bash
# Using your preferred AUR helper:
yay -S auralune-bin
# or
paru -S auralune-bin
```

---

## 🛠️ Building from Source (Development)

### System Requirements (Arch Linux):
```bash
sudo pacman -S --needed base-devel git rustup nodejs npm \
  gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugin-pipewire \
  pipewire soundtouch rubberband sqlite webkit2gtk-4.1 gtk3
```

### Step by Step:
```bash
# 1. Clone the repository:
git clone https://github.com/Das-Letzte-Kemonomimi/Aura-Lune.git
cd Aura-Lune

# 2. Install frontend dependencies:
cd apps/desktop
npm install
cd ../..

# 3. Launch in development mode (Tauri 2 hot-reload):
cd apps/desktop
npm run tauri dev
```

### Building the AppImage Bundle:
```bash
cd apps/desktop
npm run tauri -- build --bundles appimage
```
The resulting package will be placed in: `target/release/bundle/appimage/`.

---

## 🧪 Testing & Code Quality

Auralune enforces a strict testing pyramid for audio fidelity and application performance:

```bash
# 1. Automated release package verification (Smoke Test):
./packaging/smoke-test.sh

# 2. Rust unit & integration test suite (audio pipeline & DSP):
cargo test --all-targets --all-features -- --test-threads=1

# 3. Format check and linter (Clippy):
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings

# 4. TypeScript type checking and frontend production bundle:
cd apps/desktop && npm run build
```

---

## 📐 Architecture & Design Decisions (ADR)

Detailed engineering decisions are documented in the `docs/` directory:
- **System Architecture Guide**: [`docs/architecture.md`](docs/architecture.md)
- **Architecture Decision Records**:
  - [ADR 0001: GStreamer Pipeline Integration & DSP Engines](docs/adr/0001-dsp-engine-integration.md)
  - [ADR 0002: Bluetooth Pro Audio Codecs & File Safety](docs/adr/0002-pro-audio-bluetooth-codecs-and-file-safety.md)
  - [ADR 0003: Library Scanner & SQLite Schema](docs/adr/0003-library-scanner-and-sqlite-schema.md)
  - [ADR 0004: Rubber Band & SoundTouch DSP Adapters](docs/adr/0004-rubberband-soundtouch-dsp-engines.md)
  - [ADR 0005: MPRIS D-Bus Desktop Integration](docs/adr/0005-mpris-dbus-desktop-integration.md)
  - [ADR 0006: Anime Theming Engine & Secure Backgrounds](docs/adr/0006-anime-theme-engine-and-custom-backgrounds.md)
  - [ADR 0007: MusicBrainz & Cover Art Archive](docs/adr/0007-musicbrainz-and-cover-art-archive.md)
  - [ADR 0008: Playback Queue & Playlist Management](docs/adr/0008-playback-queue-and-playlists.md)
  - [ADR 0009: Arch Linux Packaging (PKGBUILD) & AppImage](docs/adr/0009-packaging-arch-pkgbuild-and-appimage.md)
  - [ADR 0010: Graphic Equalizer & FFT Visualizer](docs/adr/0010-equalizer-and-spectrum-visualizer.md)
  - [ADR 0011: DSP Stability, Underrun Resilience & Unicode Safety](docs/adr/0011-dsp-stability-reverb-unicode-safety-and-recap.md)

---

## 📜 License

This project is licensed under the terms of the **GNU General Public License v3.0 or later** ([`LICENSE`](LICENSE)), in accordance with the licensing requirements of linked DSP components (Rubber Band under GPL-2.0-or-later, SoundTouch under LGPL-2.1-or-later).

**Author**: Das Letzte Kemonomimi 🌸  
*Crafted with passion for music, high-resolution audio, and free open-source software.*
