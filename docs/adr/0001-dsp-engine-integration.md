# ADR 0001: Strategia integracji silników DSP (SoundTouch i Rubber Band) z GStreamerem

- **Status**: Zaakceptowany do etapu prototypowania (Etap 0)
- **Data**: 2026-10-17
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**: Odtwarzacz wymaga niezależnej zmiany wysokości dźwięku (pitch: półtony/centy), tempa (tempo_ratio) oraz prędkości (rate_ratio) w czasie rzeczywistym, z możliwością wyboru silnika: **SoundTouch** lub **Rubber Band**.

---

## 1. Badane opcje architektoniczne

### Opcja 1: Hybrydowa z natywnym elementem GStreamera dla SoundTouch (`pitch`) + dedykowanym elementem dla Rubber Band
- **Opis**:
  - Dla **SoundTouch**: Użycie oficjalnego pluginu GStreamera `pitch` (`gst-plugins-bad`), który wewnętrznie opakowuje SoundTouch i udostępnia właściwości GObject: `pitch`, `tempo`, `rate`.
  - Dla **Rubber Band**: Zbudowanie niestandardowego elementu GStreamera w Rust (`gst::subclass::AudioFilter`) linkującego z `librubberband` przez C ABI (`rubberband-c.h`).
- **Zalety**:
  - SoundTouch działa od razu „out of the box” na Arch/CachyOS bez konieczności pisania własnego buforowania, z natywną obsługą zdarzeń segmentów i zegara GStreamera.
  - Wykorzystuje zoptymalizowane konwersje formatów audio wewnątrz potoku GStreamera.
- **Wady**:
  - Dwa różne mechanizmy obsługi wewnętrznego stanu procesorów.
  - Ograniczona kontrola nad parametrami specyficznymi dla SoundTouch (np. tryb mowy, rozmiar sekwencji AA), które nie wszystkie są wyeksponowane przez właściwości elementu `pitch`.

### Opcja 2: Zunifikowany filtr potoku oparty na wspólnym trait `AudioProcessor`
- **Opis**:
  - Stworzenie ujednoliconego elementu GStreamera (`kitsune-dsp-filter` oparty na `gst_audio::subclass::AudioFilter`), który deleguje przetwarzanie próbek do instancji implementującej trait `AudioProcessor`.
  - Zarówno `SoundTouchProcessor`, jak i `RubberBandProcessor` implementują ten sam interfejs:
    ```rust
    pub trait AudioProcessor: Send {
        fn name(&self) -> &'static str;
        fn prepare(&mut self, format: AudioFormat, max_block_frames: usize) -> Result<(), DspError>;
        fn set_params(&mut self, params: DspParams) -> Result<(), DspError>;
        fn process(&mut self, input: &[f32], output: &mut Vec<f32>) -> Result<ProcessStatus, DspError>;
        fn latency_frames(&self) -> usize;
        fn reset(&mut self) -> Result<(), DspError>;
        fn drain(&mut self, output: &mut Vec<f32>) -> Result<ProcessStatus, DspError>;
    }
    ```
- **Zalety**:
  - Identyczna semantyka, wspólna telemetria, zbieżne testy jednostkowe na surowych buforach PCM bez udziału całego pipeline'u GStreamera.
  - Pełna kontrola nad flushowaniem buforów, paddingiem i kompensacją opóźnienia.
  - Łatwa wymiana implementacji w testach (np. MockProcessor do testów seek/EOS).
- **Wady**:
  - Wymaga implementacji adaptera FFI dla obu silników (aczkolwiek SoundTouch i Rubber Band posiadają dobrze udokumentowane C ABI).

---

## 2. Macierz oceny kryteriów

| Kryterium | Opcja 1 (Gotowy `pitch` + adapter Rubber Band) | Opcja 2 (Wspólny `AudioProcessor` w elemencie GStreamera) |
|---|---|---|
| **Dynamiczny pitch/tempo/rate** | Bardzo dobry dla SoundTouch (`pitch.set_property("pitch", ...)`); dla Rubber Band wymaga adaptera. | Doskonały: wspólne wygładzanie parametrów (parameter smoothing) na granicach bloków audio. |
| **Obsługa Seek** | Automatyczna przez GStreamer dla SoundTouch; wymaga poprawnej implementacji `GstEvent::Seek` i resetu w adapterze. | Kontrolowana jawnie przez reset i drain w `AudioProcessor::reset()`. |
| **EOS & Drain** | `pitch` w GStreamerze poprawnie przepycha pozostałe próbki przed EOS. | Wymaga dokładnej obsługi `drain()` w filtrze, aby nie obcinać wybrzmienia końcówki utworu. |
| **Gapless Playback** | GStreamer radzi sobie dobrze przy `playbin3` / dynamicznym linkowaniu padów, ale zmiana parametrów pomiędzy utworami wymaga resetu filtrów. | Umożliwia precyzyjny reset stanu bez destrukcji i ponownej alokacji buforów pomiędzy utworami. |
| **Kompensacja latencji** | Element `pitch` deklaruje opóźnienie w pipeline GStreamera. | Jawne raportowanie `latency_frames()` i przesyłanie zdarzenia `GstMessageLatency` do magistrali. |
| **Użycie CPU & Xruns** | SoundTouch: bardzo niskie (<1% CPU). Rubber Band (R3): wyższe (ok. 2-5% CPU), zależne od trybu transjentów. | Identyczne zużycie CPU dla rdzeni DSP, zoptymalizowany brak niepotrzebnych kopii pamięci. |
| **Licencjonowanie** | SoundTouch: LGPL-2.1-or-later. Rubber Band: GPL-2.0-or-later. | Dokładnie to samo: włączenie Rubber Band wymusza GPL-3.0-or-later dla całego artefaktu binarnego. |
| **Packaging (Arch/CachyOS)** | Pakiety systemowe `gstreamer`, `gst-plugins-bad`, `soundtouch` i `rubberband` są dostępne w repozytorium dystrybucji. | Wymaga nagłówków dev `rubberband` i `soundtouch` w czasie budowy (oba są obecne w systemie deweloperskim). |

---

## 3. Decyzja

1. **W Etapie 0 (Spike & Walking Skeleton)**:
   - Jako bazowy wariant odtwarzania i weryfikacji pipeline'u przyjmujemy element **`pitch` (SoundTouch)** z `gst-plugins-bad`. Zapewnia on natychmiastowe działanie, stabilność wątkową i bezpośrednią weryfikację integracji PipeWire.
   - Jednocześnie wdrażamy warstwę abstrakcji domenowej `crates/dsp-api` (`AudioProcessor`, `DspParams`, `AudioFormat`), która definiuje matematyczny model konwersji (np. półtony na współczynnik pitch: $ratio = 2^{\frac{semitones}{12}}$).
2. **W Etapie 3 (Pełne DSP)**:
   - Wdrażamy natywny moduł `crates/dsp-rubberband` wykorzystujący `rubberband-c.h` (`RubberBandLiveShifter` / `RubberBandStretcher`) jako wymienny procesor w potoku lub za pośrednictwem dedykowanego filtru `gst::subclass`.
3. **Licencja repozytorium**:
   - Przyjmujemy **GPL-3.0-or-later** dla całego projektu, co w pełni respektuje licencję GPL-2.0-or-later biblioteki Rubber Band oraz LGPL-2.1-or-later biblioteki SoundTouch.
