# FEATURE_MATRIX.md — Rejestr i macierz aktualnych funkcji Auralune (v0.9.3)

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
- [x] **GStreamer Pipeline**: Potok `uridecodebin -> audioconvert -> audioresample -> queue -> DSP -> volume/replaygain -> pipewiresink/autoaudiosink`.
- [x] **Wyjście PipeWire z autodetekcją**: Wykrywanie obecności serwera PipeWire, bezpieczny fallback do PulseAudio/ALSA.
- [x] **Pro Audio & Bluetooth Codec Switcher**: Zmiana profilu karty na `Pro Audio`, wybór kodeka Bluetooth wysokiej rozdzielczości (LDAC, aptX HD, AAC, SBC-XQ).
- [x] **Konfigurowalny bufor audio**: Zmiana rozmiaru bufora `audio_buffer_duration_ms` (10 ms – 1000 ms) w Ustawieniach.
- [x] **Gapless Playback**: Bezprzerwowe odtwarzanie kolejnych utworów przy wsparciu dekodera.
- [x] **Smart Silence Trimming**: Automatyczne wykrywanie i przycinanie ciszy na początku i końcu utworu (`get_silence_trimming_config` / `set_silence_trimming_config`).
- [x] **Pełne zapamiętywanie sesji odtwarzania (Session Persistence)**: Opcjonalne przywracanie ostatniego utworu, dokładnej pozycji czasowej, poziomu głośności (liniowego oraz dB), parametrów DSP oraz trybu widoku po ponownym uruchomieniu z dedykowanym przyciskiem w Ustawieniach.

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
  - 10 suwaków od 31 Hz do 16 kHz (-12 dB do +12 dB) z autostartem i bypass.
  - Presety fabryczne: *Flat*, *Bass Boost*, *Electronic/Dance*, *Classical/Acoustic*, *Vocal Clarity*.
- [x] **Wielopasmowy Korektor Parametryczny (PEQ Studio - `ParametricEqModal`)**:
  - Do 32 w pełni parametrycznych pasm (filtry Peak, Low Shelf, High Shelf z dobrocią $Q$).
  - Bezpieczny Headroom / Safe Preamp Protection chroniący przed przesterowaniem cyfrowym (clippingiem).
  - Interaktywny wykres odpowiedzi częstotliwościowej SVG z przeciąganiem węzłów (35 ms throttle).
  - **Parser i eksporter profili EqualizerAPO / AutoEQ** w formacie `.txt`.
- [x] **Baza Profili Słuchawkowych AutoEQ (`AutoEqModal`)**:
  - Wbudowana baza gotowych profili kompensacyjnych dla setek modeli słuchawek (Harman Target, Crinacle, Rtings, Oratory1990) aplikowana w 1 kliknięcie.
- [x] **Studio Dynamiki (`DynamicsStudioModal`)**:
  - **Kompresor audio**: Próg (Threshold), Współczynnik (Ratio 1:1 do 20:1), Miękkie kolano (Soft Knee), Wzmocnienie wyjściowe (Makeup Gain) z wizualną krzywą transferu.
  - **Saturator lampowy/taśmowy**: Tryby *Tube Warmth*, *Tape Saturation*, *Overdrive* z regulacją Drive, Warmth i Dry/Wet mix.
  - **True-Peak Limiter**: Sztywne ograniczenie ceilingu (np. -0.2 dB) zabezpieczające przetworniki DAC przed zniekształceniami międzypróbkowymi.
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
  - Przedwzmacniacz (Pre-Amp) dla utworów z tagami RG i bez tagów RG.
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
- [x] **Wyszukiwarka Duplikatów (`DuplicateFinderModal`)**:
  - Wyszukiwanie zduplikowanych plików po metadanych i sygnaturach plików.

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
  - Wirująca płyta winylowa z fizyką i bezwładnością silnika Direct-Drive zsynchronizowaną na żywo z suwakiem DSP Tempo (0.25x – 3.00x), szybkością odtwarzania oraz tempem utworu (BPM), z płynnym rozruchem i wyhamowywaniem na pauzie, ruchomym ramieniem mechanicznym oraz wskaźnikiem RPM na żywo.
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
- [x] **Linux Ricing IPC Waybar Status (`/tmp/auralune.json`)**:
  - Atomowy eksport stanu odtwarzacza w standardzie modułów custom Waybara (`text`, `alt`, `tooltip`, `class`, `percentage`, `volume`, `art_url`, `position_ms`, `duration_ms`). Umożliwia natychmiastowe zintegrowanie odtwarzacza z Waybarem, Polybarem, Hyprlandem i skryptami środowiska bez odpytywania D-Bus.
- [x] **Kanały sterowania FIFO & Unix Socket (`/tmp/auralune_ctl`, `/tmp/auralune.sock`)**:
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
- [x] **Wymienne style ikon aplikacji**:
  - Przełącznik ikony: Styl klasyczny (*Classic Icon*) vs Styl neonowy (*Lineout Neon*).
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
- `apps/desktop/src-tauri`: Ponad 100 typowanych komend Tauri v2 łączących frontend React z backendem Rust.
- `apps/desktop`: Frontend React 19 + TypeScript + Vite ze ścisłą typizacją i zoptymalizowanymi widokami.

