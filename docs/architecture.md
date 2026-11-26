# Architektura Systemu — Kitsune Player (Auralune)

## 1. Wizja i zasady nadrzędne

Kitsune Player (nazwa kodowa repozytorium: Auralune) to natywny, zoptymalizowany dla Linuksa odtwarzacz muzyki łączący ergonomię mobilnego Powerampa z elastycznością foobar2000 oraz estetyką anime (personalizacja, tła, rozmycie, szklane panele bez utraty czytelności).

### Żelazna zasada architektoniczna
**Ścieżka audio czasu rzeczywistego jest całkowicie odseparowana od WebView (Tauri), bazy danych SQLite, zapytań sieciowych HTTP oraz blokujących operacji wejścia/wyjścia.**

```
+-------------------------------------------------------------+
|                      Frontend (Vite / React)                |
|           Zustand Store  |  TanStack Query  |  Theme Engine |
+------------------------------+------------------------------+
                               | IPC (Tauri Commands / Events / Channels)
                               | *Tylko komunikaty kontrolne i snapshoty stanu*
                               v
+-------------------------------------------------------------+
|               Desktop Integration & Service Layer           |
|         Tauri Handlers  |  MPRIS (D-Bus)  |  App State      |
+---------------+------------------------------+--------------+
                |                              |
                v                              v
+-------------------------------+  +--------------------------+
|  Library, Metadata & Storage  |  |       Audio Engine       |
|  - SQLite (sqlx)              |  |  - GStreamer Pipeline    |
|  - Scanner & Watcher          |  |  - PipeWire Output       |
|  - MusicBrainz & CAA Cache    |  |  - DSP Processor Bridge  |
+-------------------------------+  +--------------------------+
```

Próbki audio (PCM) **nigdy** nie są przesyłane przez mostek Tauri do frontendu. Frontend odbiera wyłącznie lekkie migawki stanu (aktualny czas, stan odtwarzania, poziomy głośności, tagi).

---

## 2. Podział na moduły (Workspace Rust)

Zgodnie ze specyfikacją projektu, docelowa struktura modułowa obejmuje:

- `domain` (`crates/domain`): Niezależne od frameworków typy domenowe, encje (Track, Album, Artist, QueueItem, DspPreset, Theme), reguły walidacji i czyste funkcje pomocnicze.
- `dsp-api` (`crates/dsp-api`): Ujednolicony kontrakt przetwarzania DSP (`AudioProcessor`), semantyka parametrów (`DspParams`: pitch w półtonach, tempo_ratio, rate_ratio), typy formatów audio i możliwości silnika (`DspCapabilities`).
- `dsp-soundtouch` (`crates/dsp-soundtouch`): Adapter dla silnika SoundTouch (natywny lub przez element `pitch` GStreamera).
- `dsp-rubberband` (`crates/dsp-rubberband`): Adapter dla silnika Rubber Band (poprzez `librubberband` C ABI / live stretcher).
- `audio-engine` (`crates/audio-engine`): Zarządzanie pipeline'em GStreamera, pętla bus messages (Error, Warning, EOS, StateChanged), pozycjonowanie/seek, dynamiczne sterowanie DSP, wyjście PipeWire.
- `library` (`crates/library`): Skaner biblioteki, ekstrakcja tagów, obsługa grafik okładek.
- `metadata` (`crates/metadata`): Klient MusicBrainz i Cover Art Archive z cache'owaniem i throttlingiem.
- `storage` (`crates/storage`): Warstwa SQLite, migracje bazy danych, repozytoria.
- `desktop` (`src-tauri`): Warstwa integracji Tauri 2, komendy IPC, obsługa D-Bus MPRIS.
- `ui` (`src`): Interfejs użytkownika React + TypeScript + CSS tokens.

---

## 3. Audio pipeline

The playback pipeline is a single GStreamer graph, built in `crates/audio-engine/src/pipeline/graph.rs`. The order below is the real link order:

```
uridecodebin            (auto demux & decode: FLAC, MP3, OGG/Opus, WAV, AAC…)
  -> queue_in
  -> audioconvert -> audioresample
  -> capsfilter         (F32LE, interleaved)
  -> auralune_dsp       (pitch/tempo: Rubber Band / SoundTouch, lock-free bypass)
  -> freeverb           (reverb)
  -> equalizer-10bands  (graphic EQ)
  -> peq_preamp         (volume element: parametric EQ / AutoEQ preamp)
  -> equalizer-nbands   (parametric EQ)
  -> audiodynamic       (compressor)
  -> compressor_makeup  (volume element: makeup gain)
  -> saturator          (identity element + F32 pad probe)
  -> stereo_widener     (identity element + F32 pad probe, Mid/Side)
  -> bs2b               (crossfeed)
  -> rgvolume           (ReplayGain: track/album gain, pre-amp, fallback gain)
  -> rglimiter          (soft clip protector, enabled with "prevent clipping")
  -> spectrum           (analyser for the visualisers)
  -> audioconvert -> audioresample
  -> queue_sink
  -> volume             (user volume: linear gain 0..1, smooth ramps in pipeline/fades.rs)
  -> sink               (pulsesink via pipewire-pulse, then pipewiresink, then autoaudiosink)
```

The user volume is the last stage before the sink, so it never changes what the EQ, dynamics, ReplayGain or the spectrum see. The UI maps the slider position to this linear gain through a perceptual curve (`src/utils/volumeCurve.ts`); IPC, MPRIS and the saved `playback_volume` setting always carry linear gain.

### Isolation and safety
1. **No allocation in critical callbacks**: DSP parameters are passed asynchronously through thread-safe structures with atomics, or through GStreamer element properties.
2. **Latency compensation**: Rubber Band in real-time mode adds a fixed latency (start delay). The pipeline must report and correct time segments so seeking and the position shown in the UI stay accurate.
3. **Smooth parameter changes**: pitch and tempo change without restarting the pipeline, with values smoothed at audio block boundaries to avoid clicks and pops.

---

## 4. Licencje i zgodność prawna

- **SoundTouch**: LGPL-2.1-or-later. Pozwala na dynamiczne linkowanie w projektach komercyjnych i open source.
- **Rubber Band**: GPL-2.0-or-later. Linkowanie z Rubber Band wymaga udostępnienia kodu na licencji kompatybilnej z GPL (rekomendowana licencja całego projektu: **GPL-3.0-or-later**).
- **GStreamer**: LGPL-2.1-or-later z wyjątkami dla niektórych wtyczek (bad/ugly).

---

## 5. Tryb Pro Audio i kodeki Bluetooth (PipeWire)

### Tryb Pro Audio
- Bezpośredni dostęp do kart dźwiękowych ALSA bez programowego resamplingu (bit-perfect).
- Wybór profilu `pro-audio` karty dźwiękowej w PipeWire dla interfejsów audio i przetworników USB DAC.
- Negocjacja formatu bez degradacji próbkowania (np. 96 kHz / 192 kHz / 24-bit).

### Wybór kodeków Bluetooth
- Integracja z PipeWire / WirePlumber (`bluez5`) umożliwiająca wykrywanie podłączonych słuchawek i głośników Bluetooth oraz przełączanie profilu A2DP:
  - **Sony LDAC** (`a2dp-sink-ldac` — wysoka jakość do 990 kbps, 96 kHz),
  - **Qualcomm aptX HD** (`a2dp-sink-aptx_hd`),
  - **Qualcomm aptX** (`a2dp-sink-aptx`),
  - **MPEG-4 AAC** (`a2dp-sink-aac`),
  - **SBC-XQ** (`a2dp-sink-sbc_xq` — ulepszony SBC),
  - **SBC** (`a2dp-sink` — standardowy).

---

## 6. Obsługa formatu Opus i nieniszczący transkoder

- **Odtwarzanie Opus**: Natywne wsparcie dla plików `.opus` (kontener OGG) przez potok GStreamer z pełną obsługą pitch-shiftu i time-stretchingu.
- **Transkodowanie**: Dedykowany potok eksportu pozwalający przekonwertować plik do formatu Opus, FLAC lub WAV. Operacja zawsze tworzy nowy plik docelowy i nigdy nie modyfikuje pliku źródłowego.

---

## 7. Żelazna zasada nienaruszalności plików użytkownika (Read-Only Policy)

- **Aplikacja jest w 100% bezpieczna dla dysku**: W całym kodzie backendu i UI **nie istnieje możliwość usunięcia fizycznego pliku audio z dysku**.
- Wszelkie akcje usunięcia z kolejki, playlisty lub biblioteki modyfikują wyłącznie stan aplikacji / wpis w bazie SQLite, pozostawiając pliki na dysku nienaruszone.

