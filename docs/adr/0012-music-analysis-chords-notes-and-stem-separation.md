# ADR 0012: Architektura Pakietu Music Analysis (Detekcja Akordów, Transkrypcja Nutowa i Separacja Stemów)

- **Status**: Zaakceptowany (Accepted)
- **Data**: 2026-11-14
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**: Auralune rozwija się jako zaawansowany odtwarzacz muzyczny dla audiofilów, producentów i entuzjastów muzyki na Linuksie. Użytkowniczka zgłosiła potrzebę wdrożenia kompleksowego zestawu narzędzi analizy muzycznej:
  1. Detekcji akordów w czasie rzeczywistym i osi czasu progresji zharmonizowanej z siatką taktów (beat grid) oraz odtwarzaniem.
  2. Polifonicznej transkrypcji nutowej z interaktywnym widokiem Piano-Roll i eksportem do formatu MIDI.
  3. Separacji utworu na instrumenty/ścieżki (stems: Vocals, Drums, Bass, Other), z możliwością niezależnego miksowania, wyciszania wokalu (tryb Karaoke) i solowania.
  4. Bezpiecznego zarządzania modelami uczenia maszynowego (bez zaśmiecania repozytorium git i paczek instalacyjnych wagami sieci neuronowych).

---

## 1. Badane opcje architektoniczne

### Opcja 1: Monolityczne dołączenie modeli ONNX do paczki i wbudowanie w ścieżkę audio
- **Opis**: Dołączenie wag modeli Demucs i Basic Pitch do artefaktu binarnego AppImage oraz uruchamianie inferencji bezpośrednio w procesie odtwarzacza.
- **Wady**:
  - Rozmiar paczki AppImage wzrósłby z 47 MB do ponad 1.5–2.5 GB.
  - Wymóg bibliotek CUDA/ROCm/ONNX Runtime na etapie instalacji u każdego użytkownika, nawet jeśli chce jedynie słuchać muzyki.
  - Ryzyko zacięć dźwięku (xrun) przy współdzieleniu wątków audio i procesów inferencji.

### Opcja 2: Architektura hybrydowa z flagą Cargo `analysis-ml`, offline workerem i synchronicznym Stem Mixerem (Wybrana)
- **Opis**:
  1. **Podział funkcjonalny**:
     - **Rdzeń klasyczny DSP (zawsze aktywny, zero wag)**: Algorytm dopasowywania szablonów chromagramu Krumhansla-Schmucklera i Harte'a z wygładzaniem HMM/Viterbiego dla akordów oraz spektralna analiza salience dla nut. Działa w 100% lokalnie, natychmiastowo i bez pobierania jakichkolwiek plików z sieci.
     - **Moduł ML (`analysis-ml`)**: Opcjonalne włączenie zaawansowanych modeli głębokich (HTDemucs dla separacji ścieżek, Spotify Basic Pitch dla transkrypcji polifonicznej) poprzez `ort` lub zewnętrzny dedykowany proces sidecar.
  2. **Menedżer Modeli (Model Manager)**:
     - Wagi modeli **nigdy** nie są dołączane do repozytorium git ani paczki AppImage.
     - Pobieranie modeli odbywa się wyłącznie na jawne żądanie użytkowniczki w Ustawieniach, ze sprawdzaniem sumy kontrolnej SHA-256 i zapisem w `~/.local/share/auralune/models/`.
  3. **Separacja i Stem Mixer w torze audio**:
     - Separacja realizowana jest w tle jako zadanie asynchroniczne (`AnalysisJobQueue`) o niskim priorytecie (nice), bez zakłócania wątku audio.
     - Zapis rozdzielonych ścieżek do bezstratnego formatu FLAC w `~/.cache/auralune/stems/<hash>/`.
     - Mikser ścieżek (`StemMixer`) sumuje próbki synchronicznie w locie z próbkową precyzją (sample-accurate) i przekazuje wynik do `queue_in -> AuraluneDsp`. Zapewnia to identyczne działanie Rubber Band, SoundTouch, equalizera i limitera na zmiksowanych stemach bez desynchronizacji zegara.

---

## 2. Decyzje projektowe

1. **Flaga Cargo**: Utworzenie flagi `analysis-ml` dla crate'ów `audio-engine` oraz `auralune-desktop`.
2. **Możliwości środowiska (Capabilities)**: Komenda Tauri `get_analysis_capabilities` zwraca możliwości sprzętowe i stan modeli, pozwalając interfejsowi ukrywać lub aktywować odpowiednie funkcje.
3. **Baza danych SQLite**: Wprowadzenie addytywnych migracji tworzących tabele:
   - `track_chords` (przechowuje siatkę taktów, akordy i ewentualne korekty użytkowniczki),
   - `track_transcriptions` (przechowuje wyekstrahowane nuty MIDI),
   - `stem_tracks` (ścieżki do wygenerowanych plików FLAC dla poszczególnych stemów),
   - `ai_models` (rejestr zainstalowanych modeli z sumami SHA-256 i licencjami).
4. **Interfejs użytkownika**:
   - `ChordTimelineView`: responsywna oś czasu akordów z synchronizacją z pozycją utworu, transpozycją przy zmianie Pitch Shift i eksportem do ChordPro/MIDI.
   - `PianoRollCanvas`: widok piano-roll na płótnie HTML5 Canvas z możliwością nawigacji kliknięciem w nutę i eksportem do pliku `.mid`.
   - `StemMixerModal`: mikser 4 ścieżek (Vocals, Drums, Bass, Other) z regulacją głośności, solo/mute i szybkim trybem Karaoke.
   - `ModelManager`: panel pobierania i importu modeli w Ustawieniach z weryfikacją sumy kontrolnej SHA-256.

---

## 3. Konsekwencje i Korzyści

- **Bezpieczeństwo rozmiaru paczki**: AppImage zachowuje lekki rozmiar (~47 MB).
- **Zgodność z licencją GPL-3.0**: Weryfikacja licencji każdego modelu (np. Apache-2.0 dla Spotify Basic Pitch, MIT/CC dla modeli Demucs).
- **Czysta izolacja wątku audio**: Callback audio nie wykonuje alokacji pamięci, zapytań SQL ani żądań sieciowych.
- **Płynna obsługa w locie**: Użytkowniczka może w czasie rzeczywistym zmieniać tempo (Rubber Band/SoundTouch) oraz tonację, a wykryte akordy i nuty automatycznie transponują się w interfejsie.

