# ADR 0012: Architektura natywnego portu Android (Auralune Mobile v0.1.0)

- **Status**: Zaakceptowany (etap implementacji na gałęzi `android/v0.1.0`)
- **Data**: 2026-11-01
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**:
  Aplikacja Auralune (Kitsune Player) osiągnęła na pulpicie Linuksa dojrzałą wersję 0.7.7. Celem jest stworzenie natywnej wersji mobilnej dla systemu Android (v0.1.0) z zachowaniem pełnej parzystości funkcji (silniki DSP SoundTouch i Rubber Band, 10-pasmowy korektor, analizator widma FFT, detekcja tonacji/BPM, synchronizowane teksty LRC, pętla A-B, motywy anime glassmorphism z cząsteczkami) przy jednoczesnym bezwzględnym zachowaniu stabilności i braku regresji wersji desktopowej (0.7.7, gałąź `main`).

---

## 1. Wybór powłoki i architektury interfejsu (Tauri 2 Mobile)
- **Decyzja**: Zachowanie współdzielonego frontendu React + TypeScript + Vite osadzonego w powłoce Tauri 2 Mobile (Android).
- **Uzasadnienie**:
  - Pozwala na 100% reużycie estetyki anime glassmorphism, suwaków neonowych, silnika motywów, wizualizacji FFT na canvasie, bazy tekstów piosenek i logiki Zustand.
  - Eliminuje konieczność przepisywania interfejsu od zera w Jetpack Compose i dublowania logiki stanu.
  - Wersja Androida adaptuje interfejs do obsługi dotykowej (strefy dotyku >= 48dp, safe-area insets, obsługa gestów i paska nawigacji).

---

## 2. Abstrakcja silnika audio (AudioBackend Trait)
- **Problem**:
  Wersja desktopowa opiera się na GStreamerze (`gstreamer-rs`) i PipeWire (`pipewiresink`). Linkowanie GStreamera na Androidzie wiąże się z ogromnym narzutem rozmiaru paczki (ponad 100 MB) oraz niestabilnością dynamicznego ładowania wtyczek.
- **Decyzja**:
  Wprowadzenie warstwy abstrakcji `AudioBackend` w rdzeniu silnika audio:
  - Dla Linuksa (`cfg(target_os = "linux")`): istniejący potok GStreamer + PipeWire pozostaje nienaruszony.
  - Dla Androida (`cfg(target_os = "android")`): natywny backend audio oparty o:
    1. Czysto rustowy dekoder wieloformatowy **Symphonia** (FLAC, MP3, AAC/M4A, Ogg Vorbis, Opus, WAV w jakości do 24-bit/96kHz+).
    2. Bezblokową kolejkę pierścieniową (lock-free ring buffer) izolującą dekodowanie od wątku czasu rzeczywistego.
    3. Wymienne przetwarzanie DSP za pomocą istniejącego kontraktu `AudioProcessor` (SoundTouch oraz Rubber Band skompilowane statycznie przez NDK).
    4. 10-pasmowy filtr IIR (biquad peaking EQ) oraz filtr pogłosu i ogranicznika ReplayGain.
    5. Wyjście o niskiej latencji przez **AAudio / Oboe**.

---

## 3. Integracja z systemem Android (MediaSession, Foreground Service i Uprawnienia)
- **Decyzja**:
  - Odtwarzanie w tle realizowane jest za pośrednictwem Android `ForegroundService` z typem `mediaPlayback` i powiadomieniem `MediaStyle`.
  - Integracja ze sterowaniem multimedialnym (ekran blokady, słuchawki Bluetooth/przewodowe, zegarki) za pomocą `MediaSessionCompat` / `androidx.media3.session.MediaSession`.
  - Zarządzanie plikami przez Android Scoped Storage / Storage Access Framework (SAF) z trwałymi uprawnieniami URI (`takePersistableUriPermission`) oraz `READ_MEDIA_AUDIO` na Androidzie 13+.
  - Tryb Picture-in-Picture (PiP) mapowany bezpośrednio na natywny tryb PiP aktywności Androida (`enterPictureInPictureMode`).
  - Tryb kinowy (Big Screen) mapowany na tryb Immersive Fullscreen (ukrycie pasków systemowych i gestów).

---

## 4. Niezależne wersjonowanie i polityka wydań
- **Decyzja**:
  - Wersja desktopowa pozostaje nienaruszona jako `0.7.7`.
  - Wersja mobilna startuje niezależnie jako `0.1.0` (versionCode 1).
  - Wszelkie zmiany deweloperskie i commity są realizowane wyłącznie na gałęzi `android/v0.1.0`.

---

## 5. Konsekwencje i korzyści
1. **Wysoka jakość dźwięku i parzystość DSP**: użytkownicy Androida otrzymują studyjny time-stretching Rubber Band oraz SoundTouch bez kompromisów jakościowych.
2. **Bezpieczeństwo wersji desktopowej**: brak jakichkolwiek regresji na Linuksie dzięki separacji kompilacji warunkowej `#[cfg(...)]`.
3. **Płynność i izolacja wątków**: próbki audio nigdy nie przechodzą przez mostek webview, zachowując bezwzględną odporność na zacięcia (xruns).
