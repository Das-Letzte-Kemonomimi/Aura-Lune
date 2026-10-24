# Changelog — Auralune (Kitsune Player)

Wszystkie istotne zmiany w projekcie są dokumentowane w tym pliku.

Format oparty jest o [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/), a wersjonowanie projektu podlega regułom **Semantycznego Wersjonowania (Semantic Versioning)**:
- **MAJOR (X.0.0)**: Przełomowe, fundamentalne zmiany architektoniczne lub pełne wydanie stabilne (np. 1.0.0).
- **MINOR (0.X.0)**: Nowe moduły, większe funkcje i rozszerzenia (np. silnik DSP, synchronizacja lyrics, Pro Audio, obsługa nowych kodeków).
- **PATCH (0.1.X)**: Mniejsze poprawki błędów, eliminacja trzasków i zacięć audio, doszlifowanie UI i mikro-animacji.

---

## [0.2.1] — „Harmony & Precision” - 2026-10-24
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Wykrywanie tonacji muzycznej i tempa BPM (Key & BPM Detection / Analysis)**:
  - Zaawansowany moduł analizy harmonicznej i rytmicznej w `crates/audio-engine/src/analysis.rs`.
  - Detekcja tonacji muzycznej z wykorzystaniem 12-klasowego profilu Krumhansl-Schmuckler (Krumhansl-Kessler) bazującego na chromagramie energii FFT (Major & Minor dla wszystkich 12 tonacji).
  - Wykrywanie tempa BPM z wykorzystaniem funkcji autokorelacji obwiedni spektralnej (Spectral Flux) w zakresie 60–200 BPM.
  - Nowe interaktywne okno `KeyBpmModal` z wizualizacją chromagramu, rekomendacjami Camelot Wheel dla miksowania harmonicznego oraz 1-kliknięciowym dostosowaniem tonacji (Pitch Shift) i tempa w odtwarzaczu.
  - Trwały zapis wykrytej tonacji i tempa w bazie SQLite (`musical_key`, `bpm`) w tabeli `tracks`.
- **Wyszukiwanie okładek online HD z Deezer API i Apple Music / iTunes Search API**:
  - Rozbudowano moduł metadanych w `crates/metadata/src/lib.rs` o automatyczne odpytywanie Deezer API oraz iTunes Search API obok Cover Art Archive.
  - Umożliwiono pobieranie okładek w wysokiej rozdzielczości (do 1200x1200px) nawet w przypadku braku identyfikatorów MBID w pliku audio.
  - Inteligentne oczyszczanie tytułów i nazw wykonawców (`clean_album_title`: usuwanie tagów `[Remastered]`, `(Deluxe Edition)`, `[Disc 1]` itp.).
- **Otwieranie folderu z plikiem utworu w menedżerze plików**:
  - Nowa komenda `open_file_folder` w backendzie Tauri oraz przycisk w menu kontekstowym utworu otwierający folder zawierający plik z zaznaczeniem w natywnym menedżerze (Dolphin / Nautilus).
- **Precyzyjna regulacja parametrów DSP o ±0.1 oraz ręczne wpisywanie wartości**:
  - Przyciski szybkiej zmiany `-0.1` oraz `+0.1` w panelach Pitch Shift, Tempo oraz Szybkości w doku Now Playing.
  - Bezpośrednie pola tekstowe `<input type="number">` pozwalające użytkowniczce wpisać dokładną wartość z klawiatury (np. `1.15`, `-3.5`).
- **Pogłos studyjny Freeverb (Reverb Engine)**:
  - Zintegrowano element Freeverb z potokiem GStreamer wraz z kontrolkami rozmiaru pomieszczenia, tłumienia, szerokości stereo i poziomu nasycenia w DSP Studio.
- **Dedykowany element procesora DSP GStreamer (`AuraluneDsp`)**:
  - Nowy natywny element potoku GStreamer (`crates/audio-engine/src/dsp_node.rs`) obsługujący format F32LE z elastyczną poduszką buforową FIFO (`cushion_frames = 2048`).
- **Ekranowe powiadomienie głośności (Volume OSD) oraz modal powitalny (Onboarding Modal)**:
  - Komponent `VolumeOsd` wyświetlający nowoczesne powiadomienie przy zmianie głośności.
  - Komponent `OnboardingModal` prowadzący użytkowniczkę przy pierwszym uruchomieniu aplikacji.

### Naprawiono (Fixed)
- **Synchronizacja osi czasu, wskaźnika postępu, fali dźwiękowej i zakładek ze spowolnionym tempem DSP**:
  - Skorygowano obliczanie pozycji w `calculate_media_position`: pozycja ze sprzętowego zegara sinka jest prawidłowo skalowana przez rzeczywisty mnożnik prędkości DSP (`tempo_ratio * rate_ratio`).
  - Wyeliminowano problem wybiegania licznika czasu i wskaźnika fali przed dźwięk przy spowolnionym odtwarzaniu (np. przy 0.55x).
  - Wprowadzono automatyczny re-anchoring bazy czasowej przed zmianą parametrów prędkości w locie (`set_dsp_params`), zapobiegając jakimkolwiek skokom lub opóźnieniom na osi czasu.
- **Eliminacja przerywania dźwięku, zacinania i głodzenia bufora („jakby bufor nie nadążał”)**:
  - Usunięto sztuczne przetrzymywanie próbek („cushion”) w `AuraluneDsp`, które blokowało wypychanie pakietów audio do potoku i powodowało opóźnianie znaczników czasowych PTS względem zegara sprzętowego.
  - Zaimplementowano natychmiastowe opróżnianie FIFO w ciągłych blokach do 2048 ramek (~46ms) z monotonicznym czasem PTS, zapewniając stały i równomierny strumień PCM do PipeWire.
  - Zastosowano zoptymalizowany pod kątem niskiej latencji silnik `RUBBERBAND_OPTION_ENGINE_FASTER` (R2) z `PITCH_HIGH_QUALITY` i `TRANSIENTS_CRISP`, co zredukowało zużycie CPU o ~75% w czasie rzeczywistym i wyeliminowało przeciążenia na dużych blokach FLAC.
- **Natychmiastowa reakcja i płynność regulacji parametrów DSP w locie**:
  - Zredukowano bufor `queue_sink` z 2.0 s do 200 ms oraz `processing-deadline` w `pipewiresink` z 200 ms do 40 ms — zmniejszając akustyczne opóźnienie reakcji na ruch suwakiem z 2.2 s do niesłyszalnych ~150 ms.
  - Wprowadzono leading-and-trailing throttle (35 ms) na wywołaniach IPC w interfejsie React (`handlePitchChange`, `handleTempoChange`, `handleRateChange`), zapobiegając zatykaniu magistrali Tauri i blokowaniu zapytań o pozycję potoku podczas przeciągania suwaków.
- **Eliminacja efektu flangera, zniekształceń fazowych i poszarpanego dźwięku przy przełączaniu na Bypass**:
  - Zastąpiono sztuczne nadpisywanie znaczników czasowych PTS w `dsp_node` czystym, 100% bit-perfect passthrough oryginalnych buforów dekodera (`srcpad.push(buffer)`).
  - Wyeliminowano wywoływanie `rubberband.reset()` i `soundtouch.reset()` wewnątrz callbacku czasu rzeczywistego na każdym przychodzącym pakiecie (co wywoływało ciągłe alokacje/dealokacje pamięci i dropy ramek).
  - Wprowadzono automatyczny, natychmiastowy seek/flush kolejki przy zmianie silnika w locie (`set_dsp_engine`), co oczyszcza zbuforowane wcześniej rozciągnięte próbki i idealnie wyrównuje zegar GStreamer/PipeWire bez jakiegokolwiek comb-filteringu.

---

## [0.2.0] — „Kitsune” - 2026-10-18
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Wbudowana przeglądarka dziennika zmian (In-App Changelog Viewer)** w zakładce Ustawienia i sekcji O programie.
- **Wybór z 5 języków interfejsu (i18n)**: Angielski (domyślny), Polski, Niemiecki, Fiński oraz Łacina z natychmiastowym przełączaniem.
- **Wyszukiwanie i dopasowywanie okładek online (HD Web Cover Matcher)** z Cover Art Archive oraz sieci.
- **Pełne narzędzia synchronizacji tekstów piosenek (Lyrics Sync Tools)** w widoku `LyricsView`:
  - **Kompensacja przesunięcia (Offset Adjustment)**: Szybkie przyciski `[-500ms]`, `[-100ms]`, `[+100ms]`, `[+500ms]` oraz `[Reset]`.
  - **Tryb Ręcznej Synchronizacji (Tap to Sync)**: Oznaczanie poszczególnych linijek tekstu znacznikiem czasu w trakcie odsłuchu.
  - **Auto-Sync / Auto-Rozkład Czasowy**: Proporcjonalne rozmieszczenie znaczników czasu dla tekstów statycznych.
  - **Zapisywanie plików `.lrc`**: Bezpośredni eksport i trwały zapis zsynchronizowanych tekstów w formacie `.lrc` obok pliku audio.
- **Bezpieczne wyłączanie trybu Pro Audio i bezpośredni selektor profili kart**:
  - Funkcja `disable_pro_audio` przywracająca standardowy profil analogowy stereo PipeWire/WirePlumber.
  - Interaktywna lista wszystkich dostępnych profili sprzętowych (`set_card_profile`) w zakładce urządzeń.
- **Konfiguracja i trwałość stanu korektora graficznego (EQ Startup Preference)**:
  - Opcja `Włączaj korektor (EQ) automatycznie przy starcie aplikacji` w tabeli `app_settings` SQLite.
  - Domyślne uruchamianie korektora jako wyłączony (Bypass) z suwakami na poziomie 0 dB.
- **Wygodne pobieranie okładek albumów (CAA / MusicBrainz)**:
  - Przycisk `Pobierz okładkę (CAA)` bezpośrednio pod wirującą płytą w widoku Now Playing oraz w `BigScreenView`.
- **Widescreen / Skalowanie horyzontalne UI**:
  - Rozszerzono maksymalną szerokość kontenerów do `min(1500px, 95vw)` dla monitorów panoramicznych.
- **Wyłącznik czasowy z łagodnym Fade-Outem (Sleep Timer)**:
  - Presety (15–90 minut), tryb wyłączenia po bieżącym utworze, 30-sekundowy fade-out głośności i pill odliczania w nagłówku.
- **Szybkie profile klimatyczne DSP 1-kliknięciem (Quick DSP Vibes)**:
  - Presety: **Nightcore** (+25% speed z tonacją), **Slowed & Lo-Fi** (-15% tempo, -2.0st pitch), **Anime Vocal Boost**, **Bass Impact** oraz **Audiophile Reset**.
- **Kolisty wizualizator Halo 360° (Circular Radial Rays) i dynamiczna aura okładki**:
  - Tryb radialnych promieni w `SpectrumVisualizer` o 48 wstęgach z neonowymi kropkami szczytowymi.
  - Dynamicznie pulsująca neonowa poświata okładki synchronizowana z basem.
- **Widok Wykonawców (Artists View) w Bibliotece**:
  - Karty artystów z miniaturową okładką, liczbą albumów i utworów, łączną liczbą odtworzeń i przyciskiem „Odtwórz wszystko”.
- **Centrum Statystyk & Podsumowanie Słuchania („Auralune Recap / Dashboard”)**:
  - Dedykowana zakładka prezentująca łączny czas słuchania, Top 5 utworów i wykonawców oraz rozkład formatów.
- **Metadane autorskie**:
  - Uzupełniono autorkę projektu: **Das Letzte Kemonomimi** w całym projekcie.
- **Natywne dialogi wyboru plików i Drag & Drop**:
  - Obsługa systemowego pickera plików oraz Drag & Drop dla tapet tła i eksportu Opus.
- **Oficjalna ikona aplikacji Auralune w środowisku Linuksa**:
  - Kompletny zestaw ikon (PNG 32x32–512x512, ICO, ICNS) dla powłoki systemowej i paska zadań.
- **Styl ikony aplikacji — Neon Lineout vs Klasyczna Anime**:
  - Wektorowa ikona **Neon Lineout** (kontur Kitsune z neonowym gradientem) i selektor stylu ikony w Ustawieniach.
- **Wgrywanie własnych okładek albumów z dysku (Custom Cover Upload)**:
  - Wgrywanie plików PNG, JPG, WebP, GIF przez Dolphin, Drag & Drop i dedykowany moduł w `CoverArtPickerModal`.
- **Precyzyjna edycja pętli A-B w milisekundach (Millisecond Loop Range Editor)**:
  - Okno `LoopEditorModal` z wpisywaniem wartości co do milisekundy, przyciskami mikro-korekty Nudge (±10ms, ±100ms, ±1s) i odsłuchem.
- **Ulepszony system i wskaźnik zakładek pozycji (Playback Bookmarks)**:
  - Pełna synchronizacja ze stanem SQLite, wizualny złoty pin na osi czasu paska postępu oraz usuwanie zakładek.

### Naprawiono (Fixed)
- **Eliminacja domyślnej ikony WebKitGTK (żółtego „W”) w KDE Plasma Wayland**:
  - Skonfigurowano nazwę programu GLib (`set_prgname("auralune")`), `StartupWMClass` oraz cache ikon hicolor.
- **Ochrona i pamięć parametrów DSP przy przełączaniu na wyjście bez DSP (Direct Bypass)**:
  - Zapamiętywanie parametrów w `last_active_dsp` i przywracanie przy powrocie do silnika Rubber Band / SoundTouch.
- **Korekta suwaka głośności w dolnym doku**:
  - Znormalizowano maksymalną wartość kontrolki do `1.0` (100%) i zapamiętywanie poziomu przed wyciszeniem.
- **Autentyczny tryb Nightcore przez Playback Speed (`rate_ratio`)**:
  - Sprzężona zmiana prędkości i tonacji (+25% prędkości z podwyższeniem tonacji o ~3.85st) oraz przycisk `1.25x`.
- **Naprawa błędu uruchamiania WebKitGTK / Canvas (SyntaxError w `addColorStop`)**:
  - Bezpieczne parsowanie kolorów CSS zapobiegające awarii Canvas gradientu.
- **Aliasy komend Tauri dla modułu DSP**:
  - Rejestracja aliasów `set_tempo_ratio`, `set_pitch_semitones`, `set_rate_ratio`.
- **Wizualizator widma FFT (Spectrum Analyzer)**:
  - Obsługa `gst::ListRef` w GStreamer dla formatów mono i stereo.
- **Optymalizacja wydajności kompozytora WebKitGTK na Linuksie**:
  - Usunięcie ciężkich filtrów `backdrop-filter` oraz `shadowBlur` z Canvas, eliminacja lagów i płynne 60 FPS.

---

## [0.1.5] — „Equalizer & Live Spectrum” - 2026-10-17
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **10-pasmowy korektor graficzny (10-Band Graphic Equalizer)**:
  - Integracja elementu `equalizer-10bands` w potoku GStreamer.
  - Zdefiniowane presety studyjne: Flat, Rock, Pop, Jazz, Electronic, Vocal Boost, Bass Boost, Treble Boost.
- **Wizualizator widma na żywo (Live Neon Spectrum Analyzer)**:
  - Integracja elementu `spectrum` GStreamer z analizą FFT na 16/32 pasmach częstotliwościowych.
  - Tryby wizualizacji: Słupki (Bars), Fala (Waveform) oraz Odbicie lustrzane (Mirrored).

---

## [0.1.4] — „Desktop Packaging” - 2026-10-16
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Pakiet Arch Linux**:
  - Skrypty `PKGBUILD` oraz `PKGBUILD-git` dla dystrybucji Arch Linux, EndeavourOS i CachyOS.
- **Paczka AppImage**:
  - Samodzielny pakiet AppImage z osadzonym frontendem React i backendem Tauri.
- **Zestaw testów smoke**:
  - Testy weryfikujące poprawność uruchamiania backendu i potoku audio.

---

## [0.1.3] — „Queue & System MPRIS” - 2026-10-15
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Kolejka odtwarzania (PlaybackQueue)**:
  - Zaawansowane zarządzanie kolejką utworów: dodawanie następnego, przesuwanie, usuwanie, czyszczenie.
  - Tryby odtwarzania: Normalny, Powtarzanie utworu (Loop Track), Powtarzanie kolejki (Loop Queue) oraz Mieszanie (Shuffle).
- **Integracja MPRIS 2.2 D-Bus**:
  - Pełna integracja z systemowymi kontrolerami dźwięku KDE Plasma, GNOME oraz klawiszami multimedialnymi klawiatury.
  - Eksportowanie metadanych (tytuł, wykonawca, album, czas trwania, okładka) i statusu odtwarzania przez D-Bus.

---

## [0.1.2] — „Online Metadata” - 2026-10-14
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Klient REST API MusicBrainz**:
  - Odpytywanie MusicBrainz o metadane wydań z jawnym User-Agentem i kontrolą limitów zapytań (rate limiting).
- **Pamięć podręczna Cover Art Archive**:
  - Pobieranie okładek albumów (front) w miniaturach 250px i 500px oraz buforowanie na dysku w SQLite/cache.
- **Baza danych SQLite**:
  - Zarządzanie danymi biblioteki za pomocą migracji SQL (`sqlx`), tabele: `tracks`, `albums`, `artists`, `playlists`, `playback_bookmarks`.

---

## [0.1.1] — „Anime Themes & Library” - 2026-10-13
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Silnik motywów Anime (Theme Engine)**:
  - System tokenów CSS: kolory, promienie, cienie, przezroczystości i rozmycia.
  - Obsługa własnych tapet tła z bezpieczną walidacją i kopiowaniem do katalogu danych aplikacji.
- **Przyrostowy skaner biblioteki (Library Scanner)**:
  - Skanowanie folderów bez blokowania interfejsu użytkowniczki.
  - Ekstrakcja metadanych audio za pomocą biblioteki `lofty-rs` z obsługą tagów ID3v2, Vorbis Comments i MP4/AAC.

---

## [0.1.0] — „Walking Skeleton” - 2026-10-12
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Podstawa architektoniczna Walking Skeleton**:
  - Tauri 2 + React + TypeScript + Vite + Rust.
- **Natywny potok multimedialny GStreamer & PipeWire**:
  - Odtwarzanie lokalnych plików bez przechodzenia próbek audio przez webview.
  - Obsługa formatów FLAC, MP3, Vorbis/OGG, WAV, Opus.
- **Pro Audio & Bluetooth Codecs**:
  - Autodetekcja profili sprzętowych kart dźwiękowych oraz kodeków Bluetooth (LDAC, aptX HD, AAC, SBC).
  - Bezpieczna transkodacja audio do formatu Opus.
