# ADR 0004: Wdrożenie wymiennych silników DSP (Rubber Band i SoundTouch) oraz architektura przełączania silników

- **Status**: Zaakceptowany
- **Data**: 2026-10-17
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**: Wymóg MVP: użytkowniczka może w czasie odtwarzania niezależnie zmieniać tempo, pitch oraz szybkość, a także przełączać pomiędzy silnikiem **SoundTouch** a **Rubber Band** kontrolowanym restartem lub płynną ścieżką z zachowaniem pozycji i stanu odtwarzania.

---

## 1. Architektura modułów DSP

Wprowadzamy podział na wyspecjalizowane crate'y:

1. **`crates/dsp-api`**:
   - Definiuje wspólny kontrakt `AudioProcessor: Send`.
   - Modele: `DspParams`, `DspEngine`, `AudioFormat`, `ProcessStatus`, `DspError`.
   - Czyste reguły matematyczne: $scale = 2^{\frac{semitones}{12}}$, konwersja centów na półtony ($100 \text{ ct} = 1 \text{ st}$).
   - Capabilities silników (zakresy pitch/tempo, formanty, opóźnienie).

2. **`crates/dsp-rubberband`**:
   - Bezpośrednia integracja z `librubberband` przez C ABI (`rubberband-c.h`).
   - Obsługa trybu czasu rzeczywistego: `RubberBandOptionProcessRealTime | RubberBandOptionEngineFaster`.
   - De-interleaving wejściowego strumienia ramek `&[f32]` na dedykowane bufory kanałów i ponowny interleaving po wywołaniu `rubberband_retrieve`.
   - Raportowanie opóźnienia silnika (`rubberband_get_latency`).
   - Wymóg licencyjny: GPL-3.0-or-later w pełnej zgodzie z licencją Rubber Band.

3. **`crates/dsp-soundtouch`**:
   - Integracja z `libSoundTouch` za pośrednictwem bezpiecznego mostu C/C++ FFI (`native/c_bridge`).
   - Obsługa bezpośredniego zapisu i odbioru splecionych próbek `f32` (`putSamples`, `receiveSamples`).
   - Wygładzanie parametrów w czasie rzeczywistym i natychmiastowe czyszczenie buforów przy `reset()`.

---

## 2. Porównanie wariantów integracji z pipeline GStreamera

Przeprowadzono analizę dwóch wariantów zgodnie z zaleceniem w `AGENTS.md`:

| Kryterium | Wariant A (Zunifikowany `appsink` -> `AudioProcessor` -> `appsrc`) | Wariant B (Hybrydowy: GStreamer `pitch` dla SoundTouch + kontrolowany most dla Rubber Band) |
|---|---|---|
| **Stabilność zegara i synchronizacja A/V** | Wymaga dokładnego przeliczania timestampów (PTS) i kompensacji tempa przy wstrzykiwaniu do `appsrc`. | GStreamer natywnie zarządza segmentami czasu i zegarem potoku dla SoundTouch. |
| **Seek & Flushes** | Wymaga synchronizacji zdarzeń flush między dwoma segmentami potoku. | Natywny seek `gst::Element::seek_simple` działa bezpośrednio i atomowo w potoku. |
| **Płynność przełączania silników** | Możliwa zmiana instancji procesora w locie w pętli roboczej. | Kontrolowany restart potoku: zapamiętanie pozycji $T_{ms}$, rekonstrukcja węzła DSP, seek do $T_{ms}$ i wznowienie odtwarzania. |
| **Zużycie CPU i obciążenie pamięci** | Dodatkowe kopiowanie buforów pomiędzy appsink a appsrc. | Zero nadmiarowych kopii dla SoundTouch (`pitch`), zoptymalizowany bufor blokowy dla Rubber Band. |
| **Odporność na underruny (xruns)** | Zależna od rozmiaru bufora kolejki pośredniej. | Bardzo wysoka dzięki wewnętrznym kolejkom GStreamera. |

---

## 3. Decyzja

1. Implementujemy dwa niezależne, w pełni przetestowane adaptery implementujące `AudioProcessor`:
   - `RubberBandProcessor` w `crates/dsp-rubberband`.
   - `SoundTouchProcessor` w `crates/dsp-soundtouch`.
2. W `crates/audio-engine`:
   - Podstawowy potok GStreamera wykorzystuje zoptymalizowany element `pitch` dla silnika SoundTouch.
   - Wprowadzamy metodę `set_dsp_engine(engine: DspEngine)`:
     - Gdy wybrany jest `SoundTouch`, silnik steruje właściwościami `pitch`, `tempo`, `rate` elementu SoundTouch.
     - Gdy wybrany jest `RubberBand`, silnik dokonuje kontrolowanego, płynnego restartu potoku z zapamiętaniem pozycji w milisekundach, aktywując procesor Rubber Band.
   - Stan DSP oraz presety per-utwór/per-album są utrwalane w SQLite w tabeli `dsp_presets`.
3. Interfejs użytkownika w React udostępnia przełącznik silnika (`SoundTouch` / `Rubber Band`), suwaki pitch (w półtonach i centach), suwaki tempa (%) oraz przycisk resetu do wartości fabrycznych (1.0x / 0 st).
