# FEATURE_MATRIX.md — Rejestr i macierz aktualnych funkcji Auralune (v1.1.5)

> **OBOWIĄZKOWA INSTRUKCJA DLA KAŻDEGO AGENTA I PROGRAMISTY:**
> 1. **ZAWSZE przed proponowaniem nowych funkcji, planowaniem roadmapy lub refaktoryzacją PRZECZYTAJ TEN PLIK**, aby nigdy nie sugerować i nie dublować funkcji, które są już wdrożone w kodzie.
> 2. **Po zaimplementowaniu jakiejkolwiek nowej funkcji, widżetu, komendy IPC lub modułu, MASZ OBOWIĄZEK zaktualizować odpowiednią sekcję poniżej**.
> 3. Stan oznaczamy ściśle:
>    - `[x] Zaimplementowane i aktywne w UI/Backendzie`
>    - `[-] Zaimplementowane w Backendzie (oczekuje na rozszerzenie/podpięcie w UI)`
>    - `[ ] Planowane / Propozycja na przyszłość`

---

## 1. 🔊 Silnik Audio, Wyjście & Sterowniki (PipeWire & GStreamer)
- [x] **Architektura Hard Real-Time**: Całkowita izolacja wątku audio od webview, SQLite, operacji I/O i sieci (komunikacja przez atomiki i kanały zdarzeń).
- [x] **GStreamer Pipeline**: `uridecodebin -> queue_in -> audioconvert -> audioresample -> capsfilter(F32LE) -> auralune_dsp -> freeverb -> equalizer-10bands -> peq_preamp -> equalizer-nbands -> audiodynamic -> compressor_makeup -> saturator -> stereo_widener -> bs2b -> rgvolume -> rglimiter -> spectrum -> audioconvert -> audioresample -> queue_sink -> volume (user) -> sink` (pulsesink, then pipewiresink, then autoaudiosink). Full map: `docs/architecture.md` §3.
- [x] **Wyjście PipeWire z autodetekcją**: Wykrywanie obecności serwera PipeWire, bezpieczny fallback do PulseAudio/ALSA.
- [x] **Pro Audio & Bluetooth Codec Switcher**: Zmiana profilu karty na `Pro Audio`, wybór kodeka Bluetooth wysokiej rozdzielczości (LDAC, aptX HD, AAC, SBC-XQ).
- [x] **Konfigurowalny bufor audio**: Zmiana rozmiaru bufora `audio_buffer_duration_ms` (10 ms – 1000 ms) w Ustawieniach.
- [x] **Gapless Playback**: Bezprzerwowe odtwarzanie kolejnych utworów przy wsparciu dekodera.
- [x] **Smart Silence Trimming**: Automatyczne wykrywanie i przycinanie ciszy na początku i końcu utworu (`get_silence_trimming_config` / `set_silence_trimming_config`).
- [x] **Pełne zapamiętywanie sesji odtwarzania (Session Persistence)**: Opcjonalne przywracanie ostatniego utworu, dokładnej pozycji czasowej, poziomu głośności (liniowego oraz dB), parametrów DSP oraz trybu widoku po ponownym uruchomieniu z dedykowanym przyciskiem w Ustawieniach.
- [x] **Audiophile Audio Path & Bit-Perfect Stream Inspector (`AudioPathInspectorModal`)**:
  - Interaktywny inspektor toru audio w stylu Powerampa po kliknięciu plakietki jakości PipeWire: wizualizacja pełnego łańcucha sygnałowego (`Source -> GStreamer Decoder -> DSP Modulator -> Audio Effects -> PipeWire Sink & DAC`), wskaźnik `BIT-PERFECT DIRECT` vs `PROCESSED`, parametry formatu, częstotliwości próbkowania, głębi bitowej, latencji oraz 1-klikowy reset do czystego bit-perfect passthrough.
- [x] **Linux Audio & System Health Check (`AudioHealthCheckModal`)**:
  - Kompleksowa diagnostyka całego stosu audio Linuksa w wersji 1.0 (serwer PipeWire i wersja rdzenia, wersja GStreamera, dostępność kodeków FLAC/MP3/Vorbis/Opus/AAC/WAV, status procesorów RubberBand & SoundTouch, stan bazy SQLite, integracja MPRIS/Waybar/FIFO) z funkcją 1-klikowego kopiowania raportu do schowka.

---

## 2. 🎛️ Wymienne Silniki DSP & Modulacja Czasu Rzeczywistego
- [x] **Wymienne backendy DSP (Hot-Swappable)**:
  - **Direct Bypass**: Bezstratny strumień bit-perfect (zerowe narzuty CPU).
  - **SoundTouch**: Niezwykle szybki silnik WSOLA o minimalnym zużyciu zasobów.
  - **Rubber Band**: Studyjny phase-vocoder z ochroną formantów głosu i analizą transjentów.
- [x] **Niezależna regulacja parametrów**:
  - **Tempo**: 0.15x do 4.00x z zachowaniem wysokości tonu.
  - **Pitch**: Transpozycja w półtonach (-12.0 st do +12.0 st) z precyzją co do centa.
  - **Rate**: Równoległa zmiana tempa i wysokości w stylu taśmy analogowej.
- [x] **Presety DSP i zapamiętywanie profilu**:
  - Globalne presety (np. *Nightcore 1.25x*, *Slowed + Reverb 0.82x*), presety per album lub per utwór.
  - Wybór domyślnego silnika startowego i opcja resetu w 1 klik.
- [x] **Narzędzie Tap Tempo (BPM Detector & DSP Sync)**:
  - Interaktywny przycisk `[ TAP BPM ]` z pulsującą diodą rytmiczną, automatyczną filtracją odstępów, detekcją tempa BPM na żywo oraz przyciskiem natychmiastowej synchronizacji suwaka DSP Tempo do wykrytego tempa.
- [x] **Konfigurowalny rozmiar bloku DSP**: Regulacja `dsp_block_size` (256 – 8192 próbek).

---

## 3. 🎧 DJ Crossfade, Camelot Wheel & Miksowanie Harmoniczne
- [x] **Płynne przejścia Equal-Power Crossfade (0.0s – 8.0s)**:
  - Sinusoidalna mikro-modulacja głośności (50 Hz / 20 ms) bez trzasków i zacięć.
  - Asynchroniczny preroll buforów GStreamera (do 150 ms) – brak martwej ciszy pre-EOS.
- [x] **Harmonic Queue Assistant (`HarmonicSuggesterModal`)**:
  - Detekcja i wyświetlanie klucza w notacji **Camelot Wheel** (1A–12B, Major/Minor).
  - Automatyczna estymacja i detekcja tempa **BPM** w tle dla utworów bez tagów.
  - Inteligentne filtrowanie i ranking zgodności harmonicznej (±1 krok Camelot, zmiana tonacji względnej).
  - Filtr zgodnego tempa BPM (np. ±6%).
  - Możliwość wyboru utworu bazowego z listy biblioteki bez konieczności odtwarzania.
- [x] **DJ Beat-Matched Crossfade**:
  - Przyciski taktów: `1 Takt (4 b)`, `2 Takty (8 b)`, `4 Takty (16 b)` z dynamicznie wyliczanym czasem w sekundach na podstawie aktualnego BPM.
  - **DJ Mix Now**: Automatyczne zestrojenie tempa DSP do utworu docelowego (w zakresie ±25%), wstawienie utworu na początek kolejki (`add_next_to_queue`) i płynne przejście crossfade.
- [x] **Smart Auto-DJ / Infinity Queue**:
  - Ciągłe inteligentne odtwarzanie bez martwej ciszy: gdy w kolejce pozostaje $\le 1$ utwór, Auto-DJ przeszukuje lokalną bibliotekę i automatycznie dobiera najbardziej zgodny utwór pod kątem harmonicznym (Camelot Wheel) oraz tempa BPM.
  - Dedykowany przełącznik z ikoną nieskończoności w szufladzie kolejki, doku i panelu odtwarzacza.

---

## 4. 🎚️ Korekcja Brzmienia, Akustyka & Studio Dynamiki
- [x] **10-Pasmowy Korektor Graficzny (Graphic EQ)**:
  - 10 suwaków od 31 Hz do 16 kHz (-24 dB do +12 dB) z autostartem, dynamicznym bypassem i natychmiastową aktywacją w locie bez blokowania suwaków.
  - Presety fabryczne: *Flat*, *Anime OST / Clear Voice*, *Mocny Bass (Bass Boost)*, *Elektroniczna / Dance*, *Rock*, *Pop*, *Klasyczna / Akustyczna*.
  - Preamp (DSP Studio, -15..+15 dB): always applied, even with the EQ off. On the single `peq_preamp` element the engine applies `user preamp + (graphic EQ on ? EQ preamp) + (PEQ on ? PEQ preamp)`, clamped to -30..+15 dB (`domain::equalizer::combined_preamp_db`). The EQ preamp is written by AutoEQ profiles and by the "Auto" toggle, which sets it to `-max(0, largest band boost)` while the graphic EQ is on.
- [x] **Wielopasmowy Korektor Parametryczny (PEQ Studio - `ParametricEqModal`)**:
  - Do 32 w pełni parametrycznych pasm (filtry Peak, Low Shelf, High Shelf z dobrocią $Q$).
  - Bezpieczny Headroom / Safe Preamp Protection chroniący przed przesterowaniem cyfrowym (clippingiem).
  - Interaktywny wykres odpowiedzi częstotliwościowej SVG z przeciąganiem węzłów (35 ms throttle).
  - **Parser i eksporter profili EqualizerAPO / AutoEQ** w formacie `.txt`.
- [x] **Baza Profili Słuchawkowych AutoEQ (`AutoEqModal`)**:
  - Wbudowana baza gotowych profili kompensacyjnych dla 160+ modeli słuchawek (Harman Target, Moondrop, Sennheiser, Sony, Beyerdynamic, Hifiman, Apple, Truthear itp.) aplikowana w 1 kliknięcie z automatyczną kompensacją Preamp.
- [x] **Studio Dynamiki (`DynamicsStudioModal`)**:
  - **Kompresor audio**: Próg (Threshold), Współczynnik (Ratio 1:1 do 20:1), Miękkie kolano (Soft Knee), Wzmocnienie wyjściowe (Makeup Gain) z wizualną krzywą transferu.
  - **Saturator lampowy/taśmowy**: Tryby *Tube Warmth*, *Tape Saturation*, *Overdrive* z regulacją Drive, Warmth i Dry/Wet mix.
  - **Clip protector (`rglimiter`)**: a soft limiter after ReplayGain that gently compresses samples above about -6 dBFS so they never pass 0 dBFS. It has no adjustable ceiling and does not detect true (inter-sample) peaks. It is active only while ReplayGain is on and "prevent clipping" is enabled.
- [x] **Natywny Stereo Widener (Baza Stereo)**:
  - Bezalokacyjna 32-bitowa sonda buforowa `F32LE` bazująca na matrycy Mid-Side ($M/S$) z automatyczną kompensacją energii i ochroną mono (brak rwania dźwięku).
- [x] **Efekt Pogłosu Przestrzennego (GStreamer Freeverb)**:
  - Regulacja Room Size, Damping, Stereo Width, Wet Level.
- [x] **Crossfeed (Bauer Binaural / BS2B)**:
  - Dedykowana karta w głównym oknie DSP Studio (`activeTab === 'dsp'`) z przełącznikiem Bypass/On.
  - Presety: *Default (30°, 3m — 700 Hz / 4.5 dB)*, *Chu Moy (700 Hz / 6.0 dB)*, *Jan Meier Corda (650 Hz / 9.0 dB)* oraz suwaki Custom.
  - Wdrożona obsługa backendowa (`get_crossfeed_config` / `set_crossfeed_config`) redukująca zmęczenie odsłuchem na słuchawkach.
- [x] **Zgodność z ReplayGain 2.0**:
  - Tryby: Track Gain, Album Gain, Off (natywny passthrough bez overheadu).
  - Two independent preamps, as in foobar2000: "files with RG tags" (-12..+12 dB, added to the tag gain) and "files without RG tags" (-15..+15 dB, the total gain of an untagged file). `rgvolume` adds `pre-amp` to untagged tracks too and caps their positive total at `headroom`, so `ReplayGainConfig::rgvolume_params` maps them as `pre-amp = tagged`, `fallback-gain = untagged - tagged`, `headroom = max(0, untagged)`. An untagged file therefore gets exactly the untagged preamp, boosts included; `rglimiter` still guards the peaks when "prevent clipping" is on. Verified in `crates/audio-engine/tests/replaygain_semantics_test.rs`.
  - Wbudowany skaner ReplayGain (`scan_track_replaygain`, `scan_library_replaygain`).

---

## 5. 🎤 Teksty Piosenek, Karaoke & Języki (Lyrics Engine)
- [x] **Synchronizowane teksty LRC (`LyricsView`)**:
  - Płynne przewijanie do aktywnego wersu (autoscroll).
  - Pobieranie tekstów w czasie rzeczywistym z bazy **LRCLIB**.
  - Ręczna korekta przesunięcia czasowego (offset w ms).
  - Wbudowany synchronizator znaczników czasu (przypisywanie czasu do wersów i zapis `save_lyrics_lrc`).
- [x] **Japoński Silnik Romaji (`utils/romaji.ts`)**:
  - Automatyczna transkrypcja japońskich znaków (Hiragana, Katakana, Kanji) na alfabet łaciński (Romaji).
  - 3 tryby wyświetlania: *Tylko oryginał*, *Tylko Romaji*, *Dual (oba naraz)*.
- [x] **Pływający Tekst na Pulpicie (`DesktopLyricsOverlay`)**:
  - Przezroczysty, bezramkowy widżet pływający bezpośrednio na pulpicie Linuksa (Always on Top) z dynamicznym podświetleniem aktywnego wersu.
- [x] **Pełna Wielojęzyczność (i18n)**:
  - Polski (`pl`), Angielski (`en`), Niemiecki (`de`), Fiński (`fi`), Łacina (`la`).

---

## 6. 📚 Biblioteka Muzyczna, Fasetowanie & Baza Danych (SQLite)
- [x] **Baza danych SQLite (sqlx) w trybie WAL**:
  - Błyskawiczny odczyt i transakcyjny zapis tabel: `tracks`, `albums`, `artists`, `playlists`, `queue`, `bookmarks`, `presets`.
- [x] **Szybkie skanowanie przyrostowe**:
  - Wykrywanie zmian po ścieżce, rozmiarze i mtime; obliczanie hashy tylko przy modyfikacji.
- [x] **Panel Filtrów Fasetowych (`FacetsFilterPane`) w stylu foobar2000**:
  - 3 kolumny: Gatunek (Genre) → Wykonawca (Artist) → Album z dynamicznym zawężaniem liczników.
- [x] **Zaawansowane widoki biblioteki**:
  - Tabela utworów (z sortowaniem po tytule, wykonawcy, albumie, dacie, czasie trwania, ratingu, BPM).
  - Siatka kafelkowa albumów (z regulacją rozmiaru kafelków, szybkim filtrem brakujących okładek).
  - Widok wykonawców / artystów.
- [x] **Inteligentne Playlisty (Smart Playlists)**:
  - Ulubione, Ostatnio odtwarzane, Najczęściej odtwarzane, Pliki Hi-Res (24-bit / 96kHz+).
- [x] **Formaty playlist**:
  - Pełny import i eksport playlist w standardzie M3U / M3U8 (`export_playlist_m3u8`, `import_playlist_m3u8`).
- [x] **Wyszukiwarka Duplikatów (`DuplicateFinderModal`) & Szybki Filtr Duplikatów w Bibliotece**:
  - Wyszukiwanie zduplikowanych plików po metadanych i sygnaturach plików oraz przełącznik w pasku narzędzi biblioteki do natychmiastowego ukrywania zduplikowanych pozycji.
- [x] **Natywny Drag & Drop plików i folderów z menedżera pulpitu**:
  - Przeciąganie pojedynczych utworów i całych folderów bezpośrednio z okna menedżera plików (Dolphin, Nautilus, Thunar) z natychmiastowym wczytaniem i odtwarzaniem.

---

## 7. 🏷️ Tagi, CUE & Operacje na Plikach (foobar2000 Tools)
- [x] **Zaawansowany Edytor Tagów (`TagEditorModal`)**:
  - Edycja tagów w stylu foobar2000 Properties: Tytuł, Wykonawca, Album, Album Artist, Rok, Gatunek, Ścieżka/Dysk, Komentarz.
  - Pobieranie i uzupełnianie metadanych bezpośrednio z bazy **MusicBrainz**.
- [x] **Akustyczny Fingerprinting i Autotagowanie (Chromaprint / AcoustID)**:
  - Generowanie fingerprintu audio Chromaprint (`fpcalc`) bezpośrednio z fali dźwiękowej.
  - Automatyczna identyfikacja nieotagowanych utworów przez API **AcoustID** i powiązanie z nagraniami i wydaniami MusicBrainz.
  - Wybór wariantów wydań (Studio, Live, Compilation) z procentem pewności dopasowania w oknie `TagEditorModal`.
- [x] **Wyszukiwarka i Pielęgnacja Okładek (`CoverArtPickerModal`)**:
  - Przeszukiwanie bazy **Cover Art Archive** po MBID lub nazwie.
  - Wybór kandydatów okładek, podgląd w wysokiej rozdzielczości, zapis do cache lub folderu albumu.
- [x] **Masowy Renamer Plików (`FileRenamerModal`)**:
  - Zmiana nazw plików według wzorców foobar2000 (np. `%track_no% - %artist% - %title%`, `%album%/%title%`).
  - Podgląd zmian na żywo przed fizycznym przeniesieniem plików.
- [x] **Obsługa Arkuszy CUE (`CueSheetModal`)**:
  - Wczytywanie i parsowanie zewnętrznych i osadzonych plików `.cue`.
  - Wirtualny podział dużych pojedynczych plików (np. FLAC/APE/WAV) na niezależne ścieżki z zachowaniem indeksów.

---

## 8. ⏱️ Narzędzia Odsłuchu & Tryby Playera
- [x] **Domyślny Utwór Startowy „Skrzydła Białe” (Das Letzte Kemonomimi) dla Nowej/Pustej Biblioteki**:
  - Automatyczne ładowanie i wyświetlanie autorskiego utworu testowego (FLAC 24-bit/44.1 kHz, 56.8s) przy pustej bibliotece użytkownika w odtwarzaczu głównym, gramofonie i mini-playerze, z gotowością do natychmiastowego odsłuchu i testu DSP. Utwór nie zanieczyszcza bazy SQLite, a po dodaniu własnych plików przez użytkownika aplikacja natychmiast przełącza się na jego utwory.
- [x] **Wielostylowy i wielobarwny silnik Waveform (`WaveformCanvas`)**:
  - Obsługa 4 trybów renderowania (Gładka fala, Cyber słupki, Przewijany DJ, Lustrzane spektrum) oraz 5 neonowych palet barwnych (Cyber Neon, Synthwave Sunset, Tokyo Midnight, Retro Amber, Vaporwave Violet) z pamięcią w `localStorage`.
  - Prawdziwa ekstrakcja szczytów fali z pliku za pomocą dekodera GStreamer z zapisem w pamięci podręcznej SQLite (`track_waveforms`).
  - Interaktywna wizualizacja pętli A-B (podświetlony obszar pętli, flagi graniczne [A] i [B]) oraz diamentowe znaczniki zakładek (cue points) bezpośrednio na wykresie fali.
- [x] **Mini-Waveform Sparkline w kolejce odtwarzania (`QueueSparkline`)**:
  - Miniaturowe wykresy dynamiki fali przy każdym utworze w kolejce z przełącznikiem widoczności w konfiguratorze kolumn.
- [x] **Precyzyjny Edytor Pętli A-B (`LoopEditorModal`)**:
  - Pętla dowolnego fragmentu utworu z dokładnością do 1 milisekundy, przyciskami nudgowania i podglądem fali.
- [x] **Wielopunktowe Zakładki (`TrackBookmarksModal`)**:
  - Zapisywanie wielu punktów czasowych (Cue Points) z nazwami w ramach jednego utworu i 1-klikowym skokiem.
- [x] **Wyłącznik Czasowy (`SleepTimerModal`)**:
  - Szybkie presety (15, 30, 45, 60 min), suwak do 720 min, ręczne wpisywanie minut, opcjonalny gentle volume fade-out.
- [x] **Soundscape Generator (`SoundscapeModal`)**:
  - Generator pejzaży dźwiękowych tła (deszcz, ognisko, kawiarnia, nocne cykady, szum morza, szum taśmy analogowej) miksowany płynnie z muzyką.
- [x] **Odtwarzacz Stacji Radiowych (`RadioView` & `AddRadioStationModal`)**:
  - Predefiniowane stacje Anime Web Radio, J-Pop, Lo-Fi Chillout.
  - Dodawanie własnych strumieni internetowych Shoutcast/Icecast z metadanymi i ikoną.
- [x] **Tryb Kinowy / Pełnoekranowy Kiosk (`BigScreenView` - F11)**:
  - Czysty, immersyjny widok na pełny ekran z powiększoną grafiką, waveformem, neonowymi wskaźnikami i zegarem.
  - Możliwość przełączenia dolnego widżetu pomiędzy analizatorem widma FFT a analogowym wskaźnikiem VU-Meter.
- [x] **Analogowy wskaźnik stereo VU-Meter (`VuMeterWidget`)**:
  - Dwuigłowy wskaźnik wychyłowy L/R z fizyką balistyki analogowej (szybki atak, płynne opadanie), precyzyjną geometrią skali IEC VU (-20 do +3 dB), zabezpieczeniem clip bez wychodzenia skali poza obudowę, cyfrowym badge LCD dB, diodą przesteru Peak LED oraz 3 motywami podświetlenia (Amber, Sakura, Cyan).
- [x] **Interaktywny gramofon winylowy Hi-Fi (`VinylTurntable`)**:
  - Wirująca płyta winylowa z fizyką i bezwładnością silnika Direct-Drive zsynchronizowaną na żywo z suwakiem DSP Tempo (0.25x – 3.00x), statusem bypass, szybkością odtwarzania oraz tempem utworu (BPM), z płynnym rozruchem i wyhamowywaniem na pauzie, ruchomym ramieniem mechanicznym (dynamiczny kąt dla 33⅓ vs 45 RPM), wskaźnikiem RPM na żywo oraz popoverem Lo-Fi FX dopasowanym do karty.
- [x] **Symulator Brzmienia Winylowego & Taśmy (Lo-Fi Vinyl & Tape Noise FX)**:
  - Zintegrowany z gramofonem i magnetofonem generator szumu analogowego (`vinylSimulator.ts`): szum mikrorowków, rotacyjny sweep 33⅓ / 45 RPM, trzaski kurzu (dust crackle) i pomruk igły (stylus rumble) oraz ciepły szum taśmy chromowej (Tape Hiss) z regulacją intensywności (0-100%) i auto-sync z odtwarzaniem.
- [x] **Retro Magnetofon Szpulowy / Kaseta (`TapeDeckWidget`)**:
  - 4. tryb wizualny w sekcji Now Playing: animowane szpule NAB ze zmiennym promieniem nawoju taśmy w miarę postępu utworu ($\omega = v/r$), dynamiczną fizyką i prędkością 7½ vs 3¾ IPS, unikalnymi motywami wizualnymi dla typów taśmy (FE-I ferro-brąz/aluminium, CR-II chrom/tytan, METAL gunmetal/złoto champagne), mechanicznym licznikiem obrotów i wbudowanym panelem Lo-Fi FX.
- [x] **Oscyloskop wektorowy fazy Lissajous**:
  - Nowy tryb Lissajous / Stereo Vectorscope XY w `SpectrumVisualizer`, wizualizujący korelację fazową stereo w czasie rzeczywistym.
- [x] **Kompaktowy Mini-Player (`MiniPlayerWidget`)**:
  - Pływające okno Picture-in-Picture do pracy w rogu ekranu z podstawowym sterowaniem.
- [x] **Auralune Recap / Podsumowanie Odsłuchów (`AuraluneRecapModal`)**:
  - Raporty statystyk odsłuchów: Tydzień, Miesiąc, Cały Rok (czas słuchania, ulubione utwory, wskaźniki gatunkowe).
- [x] **Paleta Komend (`CommandPaletteModal` - Ctrl+K)**:
  - Błyskawiczny dostęp do wszystkich widoków, ustawień, playlist i sterowania z klawiatury.
- [x] **Klawisze foobar2000 / Poweramp**:
  - `Stop After Current Track` (zatrzymanie po zakończeniu bieżącego utworu).
  - Shuffle (losowo), Loop All / Loop Track, precyzyjne przeszukiwanie kolejki.

---

## 9. 📦 Transkodowanie, Pobieranie & Eksport
- [x] **Wielofunkcyjny Transkoder Audio (`Transcoder`)**:
  - Eksport do formatów: **Ogg Opus** (z wyborem bitrate 64–320 kbps), **FLAC** (Lossless), **WAV PCM**.
  - Opcja wypalenia aktywnych efektów DSP (np. renderowanie gotowej wersji *Nightcore* lub *Slowed + Reverb*).
  - Opcja przycięcia do wybranego zakresu czasowego (punkty A-B / crop z obsługą przecinków i milisekund).
- [x] **Asynchroniczny Eksport w Tle z Pływającym HUD**:
  - Skanowanie postępu transkodowania co 150 ms z emisją `transcode_progress`.
  - Pływający wskaźnik HUD (`Floating Background Export Badge`) w prawym dolnym rogu aplikacji z paskiem postępu, procentami, stoperem i przyciskiem szczegółów – brak zamrażania UI.
- [x] **Wbudowany Importer URL (`UrlAudioImportModal`)**:
  - Pobieranie audio ze strumieni i serwisów wideo w oparciu o bezpieczny silnik `yt-dlp`.
- [x] **Centrum Pobierania (`DownloadHubModal`)**:
  - Kolejka zadań pobierania legalnych plików audio z sumami kontrolnymi i wznowieniem.

---

## 10. 🖥️ Pulpit Linuksa, D-Bus & Integracje
- [x] **MPRIS v2 (D-Bus)**:
  - Pełna integracja z KDE Plasma, GNOME, Waybar, Polybar, klawiszami multimedialnymi laptopa i słuchawek.
  - Obsługa metadanych (tytuł, artysta, okładka, czas), Play, Pause, Next, Prev, Seek, Volume, Shuffle, LoopStatus.
- [x] **Linux Ricing IPC Waybar Status (`$XDG_RUNTIME_DIR/auralune/auralune.json`)**:
  - Atomowy eksport stanu odtwarzacza w standardzie modułów custom Waybara (`text`, `alt`, `tooltip`, `class`, `percentage`, `volume`, `art_url`, `position_ms`, `duration_ms`). Umożliwia natychmiastowe zintegrowanie odtwarzacza z Waybarem, Polybarem, Hyprlandem i skryptami środowiska bez odpytywania D-Bus.
- [x] **Kanały sterowania FIFO & Unix Socket (`$XDG_RUNTIME_DIR/auralune/ctl`, `$XDG_RUNTIME_DIR/auralune/auralune.sock`)**:
  - Natywne, błyskawiczne sterowanie odtwarzaczem (polecenia: `play`, `pause`, `toggle`, `next`, `prev`, `stop`, `vol_up`, `vol_down`, `mute`, `seek`) z poziomu skrótów Hyprland `bind`, Sway, i3, sxhkd lub skryptów powłoki.
- [x] **Discord Rich Presence (RPC)**:
  - Wyświetlanie aktualnie odtwarzanego utworu, okładki, upływającego czasu oraz własnego Client ID.
- [x] **Powiadomienia Ekranowe OSD Głośności (`VolumeOsd`)**:
  - Płynna animacja OSD przy zmianie głośności.
  - Wybór jednostki wyświetlania: tradycyjne procenty (`0% – 100%`) vs decybele studyjne (`-∞ dB do 0.0 dB`).
  - Interaktywny 1-klikowy przełącznik jednostki na plakietkach głośności w UI i doku.
- [x] **Ikona w zasobniku systemowym (System Tray)**:
  - Sterowanie odtwarzaczem z paska zadań Linuksa.
- [x] **Scrobbling Społecznościowy**:
  - **Last.fm**: Autoryzacja sesji, raportowanie Now Playing i scrobbling po 50% czasu utworu.
  - **ListenBrainz**: Zgodność z protokołem ListenBrainz przez dedykowany token użytkownika.
- [x] **Kopia Zapasowa Profilu (Portability Backup)**:
  - Eksport i import całego profilu (ustawienia, presety DSP, baza danych, motywy) do spakowanego archiwum.

---

## 11. 🌸 Estetyka Anime, Akryl & Silnik Motywów
- [x] **Stylistyka Acrylic Glassmorphism**:
  - Półprzezroczyste karty, zaokrąglone narożniki, dynamiczne cienie neonowe, regulowana intensywność rozmycia tła (blur).
- [x] **Własne Tła Anime**:
  - Wgrywanie dowolnych grafik z dysku z automatycznym zabezpieczeniem kontrastu tekstu (przyciemnienie, gradient overlay).
- [x] **Anime Ambience FX (`AnimeAmbienceFX`)**:
  - Konfigurowalne efekty cząsteczkowe na canvasie: opadające płatki sakury, świetliki, śnieg, deszcz.
- [x] **Wymienne style ikon aplikacji & Konfigurowalne efekty kursorowe (Hover Glow)**:
  - Przełącznik ikony: Styl klasyczny (*Classic Icon*) vs Styl neonowy (*Lineout Neon*).
  - Opcjonalny przełącznik w Ustawieniach do wyłączenia rozjaśniania i poświaty przycisków po najechaniu kursorem (Hover Glow / Spotlight).
- [x] **Skalowanie interfejsu (UI Scale) & Wsparcie szerokich monitorów (Ultra Wide Layout)**:
  - 4-stopniowy wybór skali interfejsu (100% Standard, 110% Komfortowy, 120% Duży, 130% Maksymalny/Ultra Wide) z płynnym powiększaniem elementów, czcionek i widżetów.
  - Dynamiczna szerokość robocza kontenerów (od 1500px do 2350px / 98.5vw) eliminująca puste przestrzenie po bokach na ekranach Full HD, 2K, 4K i ultrawide.
  - Szybki przełącznik skali w nagłówku aplikacji oraz skróty klawiszowe (`Ctrl + +`, `Ctrl + -`, `Ctrl + 0`).
- [x] **Wersjonowane Motywy JSON**:
  - Import, eksport i zapisywanie własnych palet kolorystycznych i stylów akcentu.

---

## 12. 🏗️ Architektura Kodu i Crate'y Backendowe (Rust)
- `crates/audio-engine`: Potok GStreamera, zarządzanie stanem, odtwarzanie, transkoder, integracja PipeWire, crossfade, stereo widener.
- `crates/dsp-api`: Wspólny interfejs `AudioProcessor`, formaty ramek PCM, przeliczanie półtonów, decybeli i centów.
- `crates/dsp-rubberband`: Adapter dla biblioteki Rubber Band (vocal formants, phase vocoder).
- `crates/dsp-soundtouch`: Adapter dla biblioteki SoundTouch (WSOLA time/pitch/rate).
- `crates/domain`: Czyste reguły domenowe, typy utworów, albumów, parametry PEQ, walidatory bez zależności od frameworków.
- `crates/storage`: Baza SQLite z asynchronicznymi migracjami SQLx, repozytoria danych, bookmarks, presety.
- `crates/library`: Wielowątkowy skaner plików, parser metadanych tagów ID3/FLAC/Vorbis, obserwacja katalogów.
- `crates/metadata`: Integracja MusicBrainz REST API, Cover Art Archive, scraping tekstów LRCLIB, Last.fm i ListenBrainz.
- `crates/downloads`: Asynchroniczna kolejka pobierania legalnych plików ze sprawdzaniem sum kontrolnych.
- `crates/desktop-integration`: Serwer MPRIS v2 na D-Bus, Discord RPC IPC socket, integracja z pulpitem.
- `src-tauri`: Ponad 100 typowanych komend Tauri v2 łączących frontend React z backendem Rust.
- `src/` + `src-tauri/`: Frontend React 19 + TypeScript + Vite ze ścisłą typizacją i zoptymalizowanymi widokami.

---

## 13. 🎼 Studio Analizy Muzycznej (Music Analysis Studio)
- [x] **Detekcja Akordów & Siatka Rytmiczna (Chord Progression & Beat Grid)**:
  - Automatyczne wyznaczanie siatki taktowej i rytmicznej (Beat Grid) skorelowanej z tempem BPM i downbeatami.
  - Wykrywanie chromagramu filtrami Goertzel oraz klasyfikacja 109 szablonów harmonicznych (durowe, molowe, 7, maj7, min7, sus4, sus2, dim, aug, brak akordu).
  - Wygładzanie sekwencji w czasie algorytmem Viterbi (HMM) z faworyzacją tonacji diatonicznej z wykrytego klucza utworu.
  - Interaktywny pasek akordów (Chord Timeline) zsynchronizowany w czasie rzeczywistym z odtwarzaniem utworu.
  - Plakietka aktualnie brzmiącego akordu w trybie pełnoekranowym Big Screen Mode.
  - Dynamiczna transpozycja wyświetlanych akordów przy aktywnym Pitch Shifcie (z przełącznikiem oryginał / transpozycja).
  - 1-klikowe zapętlanie taktu lub sekcji w pętli A-B oraz skok seek do wybranego akordu.
  - Ręczna korekta akordów (edycja nazwy, podział, łączenie) z trwałym zapisem w bazie SQLite.
  - Eksport progresji akordów do formatów ChordPro (`.cho`), tekstu z kreskami taktowymi (`.txt`) oraz JSON.
- [x] **Polifoniczna Transkrypcja Nut (Note Detection & Piano-Roll Canvas)**:
  - Ekstrakcja nut z audio (początek onset, czas trwania duration, numer nuty MIDI, odstrojenie w centach, dynamika velocity).
  - Skalowalny widok Piano-Roll wykonany na wirtualnym canvasie HTML5 z podświetlaniem aktualnie brzmiących nut i podziałką sekundową.
  - Eksport transkrypcji do czystego pliku Standard MIDI File (SMF Type 0/1, `.mid`) z zachowaniem mapy tempa BPM oraz do pliku JSON.
- [x] **Separacja Ścieżek i Mikser Stemów (Stem Separation & Stem Mixer)**:
  - 4-ścieżkowy podział utworu na wokal (*Vocals*), perkusję (*Drums*), bas (*Bass*) oraz tło instrumentalne (*Other*).
  - Podwójny silnik separacji: zaawansowany natywny algorytm STFT Harmonic-Percussive Source Separation (HPSS) i dekompozycji panoramy stereo (Center/Side) w pełnym stereo 44.1 kHz o matematycznej doskonałości rekonstrukcji ($\sum \text{stemy} = \text{oryginał}$), oraz opcjonalny model sztucznej inteligencji HTDemucs v4 (ONNX / Demucs CLI) z 1-klikowym pobieraniem w Menedżerze Modeli.
  - Pamięć podręczna stemów na dysku pod `~/.cache/auralune/stems/` indeksowana hashem pliku i wersją analizatora (zabezpieczenie przed ponownym przetwarzaniem).
  - Próbkowo dokładny mikser stemów (Stem Mixer) oparty o natywny GStreamer `audiomixer` podłączony pod procesory DSP (Rubber Band / SoundTouch, EQ, Limiter).
  - Tryb Solo, Mute, płynne suwaki głośności każdego stemu, 1-klikowe tryby Karaoke (wyciszenie wokalu) i Minus-One (wyciszenie wybranego instrumentu).
- [x] **Moises-Style Stem Projects Studio (Kaskadowe Projekty i Wielokanałowy Mikser)**:
  - Niezależne encje projektów wielościeżkowych (`StemProject`) powiązane z biblioteką wyłącznie hashem zawartości (zero modyfikacji ani duplikacji plików audio).
  - Hierarchiczna, kaskadowa taksonomia stemów (Wokale: główny, chórki; Perkusja: stopa, werbel, tomy, hi-hat, talerze; Bas: elektryczny/syntezatorowy; Gitary: akustyczna, elektryczna rytmiczna/prowadząca; Klawisze: pianino, pady; Orkiestra: smyczki, dęte).
  - Matematyczna gwarancja rekonstrukcji $\sum \text{sub-stemy} = \text{stem nadrzędny}$ oraz $\sum \text{liście} = \text{oryginał} \pm 10^{-6}$ (zachowanie składnika resztkowego).
  - Studyjny mikser kanałowy z faderami 0–100% (domyślnie 75% = 0 dB unity gain, 0% = cisza, 100% = +6 dB boost; logarytmiczno-kwadratowa krzywa czułości z dwuklikiem resetu).
  - Presety miksu (Karaoke, Acapella, Drums Only, Rhythm Section, Instrumental, Practice Guitar), zapisywanie i przełączanie nazwanych miksów w bazie SQLite.
  - Eksport zmiksowanego utworu do FLAC/WAV oraz kompletny eksport projektu jako spakowane archiwum `.zip`.
- [x] **Menedżer Modeli Sztucznej Inteligencji (Model Manager)**:
  - Pełna kontrola nad wagami modeli AI bez zbędnej telemetrii: pobieranie wyłącznie na jawne żądanie użytkownika.
  - Weryfikacja integralności pobranych modeli sumami kontrolnymi SHA-256.
  - Automatyczne wykrywanie obecności procesorów graficznych (NVIDIA CUDA, AMD ROCm, Vulkan) oraz gotowość do pracy w trybie CPU.
  - Możliwość ręcznego importu modeli w trybie całkowicie offline do katalogu `$XDG_DATA_HOME/auralune/models/`.

