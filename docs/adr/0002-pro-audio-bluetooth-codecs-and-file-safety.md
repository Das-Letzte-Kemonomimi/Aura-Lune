# ADR 0002: Tryb Pro Audio, kodeki Bluetooth, obsługa formatu Opus oraz zasada nienaruszalności plików

- **Status**: Zaakceptowany
- **Data**: 2026-10-17
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**: Użytkowniczka zgłosiła potrzebę:
  1. Trybu „Pro Audio” (wysoka wierność, bit-perfect, profil Pro Audio w PipeWire, ominięcie zbędnego resamplingu).
  2. Wykrywania i przełączania zaawansowanych kodeków Bluetooth (LDAC, aptX HD, aptX, AAC, SBC-XQ, SBC).
  3. Pełnej obsługi formatu Opus (odtwarzanie oraz transkodowanie/konwersja do innych formatów).
  4. Rygorystycznej zasady nienaruszalności plików: **całkowity brak możliwości usunięcia fizycznych plików z dysku z poziomu aplikacji**.

---

## 1. Tryb „Pro Audio” (PipeWire)

### Problem
Domyślne serwery dźwięku często resamplują każdy strumień do 48 kHz / 16-bit i stosują programowy mikser o zmiennym opóźnieniu.

### Decyzja
- Aplikacja integruje się z profilem `pro-audio` w PipeWire oraz konfiguruje właściwości strumienia GStreamera (`pipewiresink`):
  - Ustawienie priorytetu strumienia czasu rzeczywistego (`media.category = "Playback"`, `media.role = "Music"`).
  - Możliwość bezpośredniego przełączenia karty dźwiękowej ALSA w profil `pro-audio` (dostępny w systemie m.in. dla interfejsów Scarlett Solo, kart zintegrowanych i przetworników USB DAC).
  - W trybie Pro Audio wyłączany jest resampling, a strumień jest negocjowany w natywnej częstotliwości próbkowania pliku źródłowego (bit-perfect).

---

## 2. Zarządzanie kodekami Bluetooth (LDAC, aptX HD, aptX, AAC, SBC-XQ, SBC)

### Problem
Użytkowniczka posiadająca słuchawki Bluetooth (A2DP) chce mieć możliwość wyboru najwyższej jakości transmisji (np. Sony LDAC z bitrate 990 kbps, Qualcomm aptX HD lub SBC-XQ) bezpośrednio z poziomu odtwarzacza.

### Decyzja
- PipeWire (poprzez moduł `spa-bluez5` i WirePlumber / Pulse interface) reprezentuje kodeki Bluetooth jako profile karty `bluez_card.*`:
  - `a2dp-sink-ldac` (Sony LDAC - do 990 kbps, 96 kHz / 24-bit)
  - `a2dp-sink-aptx_hd` (Qualcomm aptX HD)
  - `a2dp-sink-aptx` (Qualcomm aptX)
  - `a2dp-sink-aac` (MPEG-4 AAC)
  - `a2dp-sink-sbc_xq` (SBC Dual Channel High Quality)
  - `a2dp-sink` (Standard SBC)
- Moduł `crates/audio-engine/src/device.rs` skanuje podłączone urządzenia Bluetooth, parsuje dostępne kodeki i udostępnia metodę przełączania profilu kodeka w czasie rzeczywistym.

---

## 3. Obsługa formatu Opus i nieniszczący transkoder plików

### Problem
Format Opus zapewnia najwyższą jakość audio przy niskich przepływnościach, a użytkowniczka potrzebuje zarówno odtwarzania, jak i konwersji plików audio do innego formatu (np. FLAC/WAV $\rightarrow$ Opus).

### Decyzja
- **Odtwarzanie**: `uridecodebin` automatycznie wykorzystuje element `opusdec` i `oggdemux`. Przetestowano pomyślne odtwarzanie i modulację DSP (pitch/tempo) na natywnym strumieniu Opus 48 kHz.
- **Konwersja (Transkoder)**: Implementacja modułu `Transcoder` w `audio-engine`, który buduje dedykowany potok eksportu:
  `uridecodebin -> audioconvert -> audioresample -> [encoder: opusenc | flacenc | wavenc] -> filesink`
- Konwersja odbywa się w tle, a plik wynikowy zapisywany jest pod nową ścieżką z odpowiednim rozszerzeniem.

---

## 4. Zasada bezpieczeństwa: Całkowity zakaz usuwania plików z dysku

### Problem
Ryzyko przypadkowego skasowania cennych plików muzycznych przez operacje w interfejsie odtwarzacza.

### Decyzja
- **Żelazna zasada**: Kod backendu odtwarzacza **nigdy nie usuwa fizycznych plików z dysku**.
- W całym repozytorium zabrania się używania funkcji `std::fs::remove_file` w odniesieniu do plików biblioteki audio.
- Wszelkie operacje typu „Usuń” w UI oznaczają wyłącznie usunięcie wpisu z playlisty, kolejki odtwarzania lub indeksu bazy danych — bez jakiejkolwiek ingerencji w system plików.
- Transkoder zapisuje nowy plik, nie nadpisując ani nie usuwając oryginału.
