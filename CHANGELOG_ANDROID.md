# Dziennik Zmian — Auralune dla systemu Android

Wszystkie istotne zmiany dla wersji Androida aplikacji Auralune (Kitsune Player) będą rejestrowane w tym dokumencie. Format opiera się na [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/), a wersjonowanie na [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-11-01

### Dodane
- **Natywny silnik audio Android (AAudio)**:
  - Implementacja backendu audio w Rust (`crates/audio-engine/src/android_backend.rs`) komunikującego się bezpośrednio z systemowym `libaaudio.so` przez Android NDK.
  - Wyjście PCM Float o niskiej latencji, praca w dedykowanym wątku audio czasu rzeczywistego (`auralune-audio-worker`).
- **Wieloplatformowy dekoder audio Symphonia**:
  - Wdrożenie czystego dekodera Rust opartego na bibliotece `symphonia` (`v0.5.4` z profilem `all`).
  - Bezpośrednia obsługa formatów: FLAC, MP3, WAV, OGG/Vorbis, AAC/M4A bez zależności od GStreamera na urządzeniach przenośnych.
  - Natywna analiza tonacji (Camelot Key) oraz tempa (BPM) przy użyciu zresamplowanego strumienia mono (`symphonia_decoder`).
- **Wbudowany silnik DSP SoundTouch (C++)**:
  - Vendoring kodu źródłowego SoundTouch C++ w `crates/dsp-soundtouch/soundtouch-src/` z automatyczną kompilacją przez `cc` podczas budowania Androida.
  - Płynna, dynamiczna zmiana tempa (`tempo_ratio`), wysokości tonu w półtonach i centach (`pitch_semitones`) oraz szybkości odtwarzania (`rate_ratio`).
  - Zaślepki FFI Rubber Band na platformie Android z czytelnym komunikatem diagnostycznym i automatycznym przekierowaniem na silnik SoundTouch.
- **Usługa odtwarzania w tle (Foreground Service) i MediaSession**:
  - Implementacja `AuraluneMediaService` jako usługi pierwszoplanowej (`foregroundServiceType="mediaPlayback"`).
  - Integracja z natywnym `android.media.session.MediaSession`: pełna kontrola odtwarzania z poziomu ekranu blokady, paska powiadomień oraz przycisków słuchawek Bluetooth.
  - Obsługa zdarzenia `ACTION_AUDIO_BECOMING_NOISY` (automatyczne wstrzymanie odtwarzania po odłączeniu słuchawek).
  - Prawidłowe zarządzanie skupieniem audio (`AudioManager.OnAudioFocusChangeListener`).
  - Mostek JNI (`MediaBridge.kt`) wiążący wywołania natywnego odtwarzacza w Rust z komponentami systemu Android.
- **Adaptacja interfejsu dotykowego i Safe Areas**:
  - Zmienne CSS dla bezpiecznych stref ekranu (`--sat`, `--sab`, `--sal`, `--sar` z `env(safe-area-inset-*)`).
  - Pływający dolny dok mini-playera oraz szuflady dostosowane do paska gestów Androida.
  - Zwiększone strefy klikalności elementów sterujących (minimum 44dp).
  - Obsługa uprawnień czasu wykonania na Androidzie 13+ (`READ_MEDIA_AUDIO`, `POST_NOTIFICATIONS`).
  - Automatyczne wyszukiwanie i wybór folderów z muzyką (`/storage/emulated/0/Music`).
