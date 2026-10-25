# Changelog — Auralune (Kitsune Player)

Wszystkie istotne zmiany w projekcie są dokumentowane w tym pliku.

Format oparty jest o [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/), a wersjonowanie projektu podlega regułom **Semantycznego Wersjonowania (Semantic Versioning)**:
- **MAJOR (X.0.0)**: Przełomowe, fundamentalne zmiany architektoniczne lub pełne wydanie stabilne (np. 1.0.0).
- **MINOR (0.X.0)**: Nowe moduły, większe funkcje i rozszerzenia (np. silnik DSP, synchronizacja lyrics, Pro Audio, obsługa nowych kodeków).
- **PATCH (0.1.X)**: Mniejsze poprawki błędów, eliminacja trzasków i zacięć audio, doszlifowanie UI i mikro-animacji.

---

## [0.6.0] — „foobar2000 Power Tools & Kitsune Facets” - 2026-10-25
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Wielopunktowe znaczniki CUE / Bookmarks w utworze**:
  - Moduł domenowy `bookmark.rs` i tabela `track_bookmarks` w SQLite z kluczem obcym i kaskadowym usuwaniem.
  - Interaktywny modal `TrackBookmarksModal` pozwalający na dodawanie nazwanych znaczników w bieżącej pozycji odtwarzania, edycję, usuwanie i natychmiastowy skok.
  - Zintegrowane diamentowe znaczniki na osi czasu odtwarzacza z podpowiedziami (tooltip) i skokiem po kliknięciu.
- **Masowy Auto-Renamer / Organizator plików**:
  - Silnik wzorców nazw w `crates/domain/src/renamer.rs` wspierający tokeny `%track%`, `%artist%`, `%albumartist%`, `%album%`, `%title%`, `%disc%`, `%ext%` oraz sanityzację znaków zakazanych w systemach plików.
  - Modal `FileRenamerModal` z podglądem na żywo starych i nowych ścieżek, ostrzeżeniami o nadpisaniach oraz atomową zmianą nazw i aktualizacją rekordów w bazie SQLite.
- **Panel filtrów fasetowych (Columns UI / Facets)**:
  - 3-kolumnowy rozwijany panel filtrów (`Format` -> `Wykonawca` -> `Album`) z licznikami utworów, lokalnym filtrowaniem wewnątrz kolumn i natychmiastowym filtrowaniem listy utworów w bibliotece.
- **Wyszukiwarka duplikatów audio (Audio Duplicate Finder)**:
  - Wyszukiwanie zduplikowanych nagrań pogrupowanych według znormalizowanego tytułu i artysty.
  - Porównanie jakości (format, bitrate, sample rate, rozmiar pliku) z możliwością usunięcia wpisu z bazy lub trwałego usunięcia pliku z dysku.
- **Eksport wycinka A-B z DSP**:
  - Transkodowanie zaznaczonego zakresu pętli A-B do plików FLAC, MP3, OGG lub WAV z zachowaniem efektów pitch-shift i tempo-stretch.
- **Pełna wielojęzyczność (i18n)**:
  - Zaktualizowane słowniki tłumaczeń dla wszystkich nowych modułów w 5 językach (PL, EN, DE, FI, LA).

---

## [0.5.0] — „Velvet Discord & Kitsune Resonance” - 2026-10-25
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Natywna integracja Discord Rich Presence (RPC) dla Linuksa**:
  - Samodzielny moduł `discord_rpc.rs` w `crates/desktop-integration` komunikujący się z lokalnym gniazdem Unix Domain Socket Discorda (`$XDG_RUNTIME_DIR/discord-ipc-0`..`9`, w tym oficjalny klient, Discord Canary, Vesktop, WebCord, ArmCord oraz Flatpak/Snap).
  - Aktywność Discorda typu „Słucha” (Listening) z tytułem utworu, wykonawcą, albumem, znacznikami czasu postępu utworu (`start` / `end`) oraz ikonami stanu (`play`/`pause`).
  - Wyświetlanie okładek albumów (Cover Art Archive / URL) w oknie Discord RPC oraz przycisk odnośnika do odtwarzacza Auralune na GitHubie.
  - Nowa szklana karta w Ustawieniach (`Settings`) z neonowym wskaźnikiem połączenia na żywo (zielona dioda po połączeniu z Discordem), przełącznikiem on/off oraz konfigurowalnym identyfikatorem aplikacji Discord (Client ID).
  - Pełne tłumaczenia interfejsu Discord RPC na 5 języków (PL, EN, DE, FI, LA).

### Naprawiono i ulepszono (Fixed & Improved)
- **Bezpieczeństwo połączenia IPC**:
  - Asynchroniczna pętla robocza Tokio z automatycznym cichym wznawianiem sesji w tle po restarcie klienta Discord bez blokowania audio callbacku ani interfejsu użytkowniczki.
- **Optymalizacja testów wielowątkowych**:
  - Usunięcie konfliktów równoległej rejestracji dynamicznych typów GStreamer w testach modułu `audio-engine`.

---

## [0.4.0] — „Kitsune Horizons & Poweramp Legacy” - 2026-10-25
**Autorka**: Das Letzte Kemonomimi


### Dodano (Added)
- **[Etap 7 z AGENTS.md] Crate `crates/downloads` & Legal Download Hub**:
  - Samodzielny moduł bezpiecznego pobierania legalnych nagrań audio (Archive.org, Creative Commons, podcasty i feedy RSS).
  - Weryfikacja integralności kryptograficznej w locie (SHA-256) oraz ścisła ochrona przed path traversal (`/etc`, `/root`, `/bin`, `../`).
  - Atomowy zapis do biblioteki poprzez bufor tymczasowy (`.auralune_tmp_*`) i natychmiastowe `fs::rename`.
  - Nowy modal `DownloadHubModal` w React z paskami postępu, stanami zadań (Pending, Downloading, Completed, Failed, Cancelled) i bezpośrednim odtwarzaniem.
- **[Klasyka Powerampa] Płynny Crossfade & Zaawansowane efekty DSP**:
  - Konfigurowalny Crossfade (0.0s – 8.0s) z równomierną krzywą mocy akustycznej (`equal-power curve: cos/sin`) eliminującą spadki głośności w środku przejścia między utworami.
  - **Bass Boost (Sub-bas Exciter)**: dedykowany moduł pobudzenia najniższych rejestrów (31–125 Hz) z suwakiem 0–12 dB i szybkimi presetami.
  - **Stereo Widener (Baza stereo)**: poszerzenie panoramy i przestrzenności sceny dźwiękowej w locie bazujące na natywnym elemencie GStreamer.
  - **True-Peak Limiter**: przełączalny limiter `rglimiter` chroniący przed przesterowaniem cyfrowym przy podbiciu EQ, pitchu i basu.
- **[Klasyka foobar2000] Import i Eksport Playlist M3U / M3U8 & Kopia zapasowa profilu**:
  - Pełny import i eksport standardu UTF-8 M3U8 (`#EXTM3U`, `#EXTINF`) z automatyczną normalizacją ścieżek względnych i bezwzględnych.
  - Eksport i przywracanie profilu użytkowniczki (presety EQ/DSP, motywy anime, playlisty, ustawienia) jako wersjonowany plik JSON.
- **[Ekosystem MetaBrainz] Oficjalny Scrobbler ListenBrainz**:
  - Klient REST API ListenBrainz (`validate_token`, `submit_playing_now`, `submit_listen`) w `crates/metadata/src/listenbrainz.rs`.
  - Automatyczne scroblowanie odtworzeń po przekroczeniu 50% czasu utworu (lub 240 sekund) z poszanowaniem prywatności.
- **[Integracja z systemem] Linux System Tray & Odtwarzanie w tle**:
  - Ikona w tacce systemowej z szybkim menu (Pokaż okno, Odtwórz/Pauza, Następny, Poprzedni, Zakończ).
  - Opcja „Minimalizuj do zasobnika zamiast zamykać” (Close to Tray) z możliwością konfiguracji w ustawieniach.

### Naprawiono (Fixed)
- **Eliminacja zakleszczenia (deadlock) przy uruchamianiu odtwarzania**:
  - Zamiana blokującego pobierania mutexu `inner` w powiadomieniu `connect_notify(Some("target-gain"))` na całkowicie bezblokadowy odczyt atomowy `Arc<AtomicU8>`.
  - Wyprowadzenie zmiany stanu potoku (`set_state`) oraz pętli wygaszania głośności mikro-fade poza blokadę mutexu, eliminując całkowite zamrażanie interfejsu przy ładowaniu plików z metadanymi głośności.
- **Pojedyncze kliknięcie w kolejce odtwarzania**:
  - Dodanie obsługi pojedynczego kliknięcia (`onClick`) w wierszu utworu w kolejce odtwarzania obok dotychczasowego dwukliku.
- **Styl pól wyboru (select) odporny na motywy systemowe GTK**:
  - Globalne wyłączenie natywnego widgetu GTK (`appearance: none; -webkit-appearance: none;`) z wymuszeniem ciemnego tła anime/glassmorphism, białych liter i różowej strzałki akcentu, zapobiegając zlewaniu się białego tekstu z jasnym tłem systemowym.
- **Rozdzielenie kolumn czasu i akcji w kolejce**:
  - Rozszerzenie kolumny akcji z 96px do 140px i optymalizacja wewnętrznego paddingu przycisków, usuwając kolizję i nakładanie się przycisku Play na czas trwania utworu.
- **Pełne tłumaczenia i18n w sekcji ListenBrainz i Crossfade**:
  - Wprowadzenie dedykowanych kluczy tłumaczeń dla wszystkich 5 języków w Ustawieniach i usunięcie zahardkodowanych polskich ciągów.

---

## [0.3.0] — „Omniscience & Starlight” - 2026-10-25
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Tag Editor / Właściwości utworu (Properties Dialog w stylu foobar2000)**:
  - Bezpośredni odczyt i atomowy zapis tagów do pliku audio (`title`, `artist`, `album`, `album_artist`, `year`, `genre`, `track_no`, `track_total`, `disc_no`, `disc_total`, `comment`) z wykorzystaniem biblioteki `lofty`.
  - Natychmiastowa aktualizacja metadanych w bazie SQLite bez konieczności powolnego ponownego skanowania biblioteki.
- **Obsługa arkuszy CUE (.cue sheet parser)**:
  - Dedykowany parser arkuszy CUE (`crates/domain/src/cue.rs`) wspierający format CD-DA 75 fps i wyliczający milisekundowe offsety.
  - Automatyczny podział japońskich wydań anime/doujin zripowanych jako jeden duży plik FLAC/WAV + `.cue` na wirtualne utwory z zachowaniem gapless playback i precyzyjnym seekowaniem.
  - Nowy modal `CueSheetModal` z listą utworów, wykonawcami, czasem trwania oraz przyciskiem dodania wszystkich ścieżek do kolejki odtwarzania.
- **Smart Playlists (Dynamiczne inteligentne playlisty z SQLite)**:
  - Generowane w czasie rzeczywistym kolekcje: *Top 25 najczęściej odtwarzanych*, *Ostatnio odtwarzane (ostatnie 50)*, *Zapomniane perełki (0 odtworzeń)*, *Hi-Res Lossless Only (FLAC/WAV ≥ 24-bit lub ≥ 96 kHz)*, *High BPM (>130 BPM)* oraz *Najwyżej oceniane (4–5 gwiazdek)*.
- **Command Palette / Szybkie wyszukiwanie (Ctrl+K / Spotlight Omnibar w stylu Powerampa)**:
  - Błyskawiczny panel wyszukiwania dostępny w dowolnym miejscu aplikacji pod globalnym skrótem klawiszowym `Ctrl+K` / `Cmd+K`.
  - Natychmiastowy skok do dowolnego utworu, albumu, wykonawcy oraz szybkie wywoływanie komend (wznów/pauza, przełączanie silnika DSP Rubber Band / SoundTouch, zerowanie pitch, tryby Anime Ambience, tryb pełnoekranowy Big Screen, skaner ReplayGain).
- **Oceny gwiazdkowe (1–5 gwiazdek) + filtr w bibliotece**:
  - Kolumna `rating` i indeks w bazie danych SQLite z interaktywnym widżetem gwiazdek w wierszu każdego utworu i natychmiastowym filtrowaniem widoku biblioteki.
- **Powiadomienia OSD Linuksa (libnotify / D-Bus)**:
  - Eleganckie banery na pulpicie Linuksa przy zmianie utworu w tle z okładką albumu, tytułem i wykonawcą.
  - Możliwość włączenia/wyłączenia w zakładce Ustawienia/Urządzenia.
- **3 nowe tryby cząsteczkowe w AnimeAmbienceFX**:
  - *Meteor Shower / Starlight*: spadające gwiazdy i komety z neonowymi ogonami i poświatą.
  - *Cyber Matrix Rain*: kaskadowy neonowy deszcz znaków katakana w stylu anime cyberpunk.
  - *Momiji*: płynnie wirujące, 5-klapowe japońskie liście klonu w odcieniach czerwieni i złota z podmuchami wiatru.
- **Rozszerzenie wizualizera FFT i skaner głośności ReplayGain EBU R128**:
  - Nowe tryby: Anime Circle Visualizer, Oscyloskop wektorowy oraz Retro Bars.
  - Analizator głośności EBU R128 offline z zapisem do bazy SQLite.

---

## [0.2.2] — „Resonance & Flow” - 2026-10-24
**Autorka**: Das Letzte Kemonomimi

### Naprawiono (Fixed)
- **Eliminacja zawieszenia aplikacji przy uruchamianiu utworu z widoku biblioteki („w bibliotece kliknęłam utwór i się zacięło”)**:
  - Wyeliminowano zakleszczenie prerollu (deadlock) w elemencie `AuraluneDsp`: usunięto restrykcyjny warunek wstrzymywania emisji próbek (`min_threshold_samples = 1024 * channels`), który przy pierwszym pakiecie dekodera wstrzymywał wypchnięcie bufora do zlewu PipeWire. Zlew PipeWire oczekujący na bufor startowy nie mógł ukończyć prerollu, co blokowało zmianę stanu potoku na `Playing` oraz powodowało zawieszenie wątku IPC na zapytaniach o pozycję/czas utworu.
  - Zastąpiono wstrzymywanie natychmiastowym drenowaniem wszystkich dostępnych próbek w blokach do 2048 ramek, co gwarantuje natychmiastowy preroll GStreamera i nieprzerwany strumień do PipeWire.
  - Przywrócono stabilne, bezpośrednie linkowanie dynamicznego padu `uridecodebin -> audioconvert_in`, eliminując pośrednią statyczną kolejkę i ryzyko zablokowania wątku dekodowania.
  - W `handlePlayLibraryTrack` w React dodano zabezpieczenie awaryjnego resetu flagi wyścigu (`isPlayingLibraryTrackRef`) z 4-sekundowym timeoutem.
- **Eliminacja zacinania i przerw w dźwięku przy odtwarzaniu plików FLAC („dalej zacina przy flacu”)**:
  - Rozwiązano problem blokowania potoku przy dużych blokach FLAC (4096–4608 ramek, które przy spowolnieniu poniżej 50% produkują ponad 260–300 ms dźwięku na pojedynczy pakiet i natychmiast przepełniały 200 ms bufor wyjściowy).
  - Zwiększono pojemność kolejki wyjściowej `queue_sink` z 200 ms do 800 ms oraz bufor `pipewiresink` do 100 ms, eliminując blokowanie wątku dekodera i zapewniając stabilne buforowanie dla PipeWire.
  - W `RubberBandProcessor` wdrożono przetwarzanie w optymalnych oknach po 1024 ramki oraz konfigurację FFI `rubberband_set_max_process_size(8192)`, co zlikwidowało reallokacje pamięci i drastyczne wahania latencji rozruchowej.

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
