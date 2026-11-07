# Changelog — Auralune (Kitsune Player)

Wszystkie istotne zmiany w projekcie są dokumentowane w tym pliku.

Format oparty jest o [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/), a wersjonowanie projektu podlega regułom **Semantycznego Wersjonowania (Semantic Versioning)**:
- **MAJOR (X.0.0)**: Przełomowe, fundamentalne zmiany architektoniczne lub pełne wydanie stabilne (np. 1.0.0).
- **MINOR (0.X.0)**: Nowe moduły, większe funkcje i rozszerzenia (np. silnik DSP, synchronizacja lyrics, Pro Audio, obsługa nowych kodeków).
- **PATCH (0.1.X)**: Mniejsze poprawki błędów, eliminacja trzasków i zacięć audio, doszlifowanie UI i mikro-animacji.

---

## [0.9.1] — „Kitsune Kinetic Groove” - 2026-11-08
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Fizyka obrotu płyty winylowej zsynchronizowana z DSP i BPM (`VinylTurntable`)**: Płyta gramofonowa wiruje teraz z realistyczną bezwładnością silnika Direct-Drive zsynchronizowaną na żywo z suwakiem DSP Tempo (0.25x – 3.00x), szybkością odtwarzania (`rate_ratio`) oraz tempem utworu (BPM). Wdrożono płynny rozruch silnika, wyhamowywanie na pauzie bez szarpnięć (zachowanie kąta spoczynkowego), spójną rotację rowków, blasków i okładki albumu oraz dynamiczny odczyt fizycznych RPM i BPM na obudowie.
- **Udoskonalona geometria i skalowanie Stereo VU-Meter (`VuMeterWidget`)**: Dokładne proporcje skali IEC VU (zakres 70° od -125° do -55°), pełne obramowanie tarczy bez wykraczania skali poza obudowę wskaźnika (`ctx.clip()`), czytelny cyfrowy odczyt dB w wyciętym okienku LCD bez kolizji z czapką igły oraz kompaktowe selektory motywów Amber/Sakura/Cyan z optymalizacją pod ekrany HiDPI/Retina.
- **Dedykowane paski parametrów pod wizualizacją w sekcji Now Playing**: Rozdzielenie kontrolek pod odtwarzaczem w zależności od aktywnego trybu – przyciski okładki (*Dopasuj okładkę / Wgraj własną*) widoczne tylko w trybie Cover, wskaźnik pracy gramofonu Direct-Drive w trybie Vinyl, a w trybie VU-Meter parametry kalibracji studyjnej (`0 VU = +4 dBu / 1.23V` • `Miernik aktywny`).
- **Dynamiczne rozszerzenie kolumny w trybie VU-Meter**: Lewa kolumna odtwarzacza płynnie adaptuje się z 240px do 280px w trybie VU, zapewniając pełną czytelność obu kanałów stereo bez ściskania elementów.

### Poprawiono (Fixed)
- **Eliminacja ucinania przycisków motywu podświetlenia w VU-Meter**: Zastąpiono przepełniające się długie etykiety zwięzłymi pigułkami, usuwając nachodzenie na siebie napisów i ucinanie przycisków w ciasnych oknach.
- **Kolizja odczytu dB ze wskazówką**: Wyeliminowano nakładanie się tekstu dB na czapkę osi obrotu igły miernika analogowego.

---

## [0.9.0] — „Kitsune Infinity & Analog Warmth” - 2026-11-07
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Bauer Headphone Crossfeed (bs2b) w DSP Studio**: Wprowadzono dedykowaną kartę filtra binauralnego Bauer bs2b bezpośrednio w głównej zakładce DSP Studio (`activeTab === 'dsp'`), obok Bass Boost, Stereo Widener i True-Peak Limiter. Karta zawiera przełącznik Bypass/On, 4 presety (Default: 700 Hz / 4.5 dB, Chu Moy: 700 Hz / 6.0 dB, Jan Meier Corda: 650 Hz / 9.0 dB, Custom) oraz płynne suwaki częstotliwości odcięcia i poziomu sprzężenia.
- **Wskaźnik analogowy stereo VU-Meter (`VuMeterWidget`)**: W pełni animowany, realistyczny dwuigłowy wskaźnik VU (kanały L i R) z fizyką balistyki analogowej (szybki atak, płynne opadanie), skalą dB (-20 do +3 dB), diodą przesteru Peak LED oraz 3 stylami podświetlenia (Amber Glow 70s, Sakura Pink, Cyber Neon).
- **Interaktywny gramofon winylowy Hi-Fi (`VinylTurntable`)**: Wirtualny odtwarzacz płyt winylowych z rowkami i obracającymi się refleksami światła, centralną etykietą z okładką albumu bieżącego utworu, mechanicznym ramieniem (tonearm opadający na płytę przy Play i parkujący przy Pause) oraz przełącznikiem prędkości obrotowej 33⅓ RPM / 45 RPM.
- **Wektorowy oscyloskop fazowy Lissajous (`SpectrumVisualizer`)**: Dodano tryb Lissajous / Stereo Vectorscope XY do wizualizera spektrum, wizualizujący korelację fazową stereo w czasie rzeczywistym.
- **Przełącznik widoków w głównym odtwarzaczu i BigScreen**: 3-pozycyjny przełącznik (Okładka • Winyl • Wskaźnik VU) w sekcji Now Playing oraz widok VU-Meter w trybie pełnoekranowym Kiosk/BigScreen.
- **Inteligentny Auto-DJ / Infinity Queue**: Ciągłe odtwarzanie bez martwej ciszy — gdy w kolejce pozostaje 1 lub 0 utworów, Auto-DJ automatycznie przeszukuje lokalną bibliotekę i dobiera najbardziej kompatybilny utwór na podstawie koła Camelota (harmonic mixing) oraz tempa BPM. Przełącznik z ikoną nieskończoności dodano w szufladzie kolejki, doku i panelu odtwarzacza.
- **Linux Ricing IPC & Waybar/Hyprland JSON Status (`/tmp/auralune.json`)**: Atomowy eksport stanu odtwarzacza w standardzie modułów custom Waybara (`text`, `alt`, `tooltip`, `class`, `percentage`, `volume`, `art_url`, `position_ms`, `duration_ms`). Umożliwia natychmiastowe zintegrowanie odtwarzacza z Waybarem, Polybarem, Hyprlandem i skryptami środowiska.
- **Global Hotkeys & Control IPC (`/tmp/auralune_ctl` & `/tmp/auralune.sock`)**: Kolejka FIFO `/tmp/auralune_ctl` oraz gniazdo Unix Domain Socket `/tmp/auralune.sock` umożliwiające bezpośrednie sterowanie (polecenia: `play`, `pause`, `toggle`, `next`, `prev`, `stop`, `vol_up`, `vol_down`, `mute`, `seek`) ze skrótów klawiaturowych Wayland/X11 (Hyprland `bind`, Sway, i3, sxhkd, Rofi).

---

## [0.8.3] — „Resonance & Harmonic Flow” - 2026-11-07
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Wybór jednostki wyświetlania głośności: Procenty (%) vs Decybele studyjne (dB)**: Wprowadzono konfigurowalny format wyświetlania poziomu głośności z możliwością wyboru pomiędzy tradycyjną skalą procentową (`0% – 100%`) a profesjonalną skalą logarytmiczną decybeli studyjnych (`-∞ dB` do `0.0 dB`, obliczaną ze wzoru $20 \log_{10}(v)$). Opcję dodano do zakładki „Audio & Devices” oraz sekcji OSD w Ustawieniach. Ponadto dodano interaktywne plakietki wartości głośności w głównym odtwarzaczu, dolnym doku, trybie pełnoekranowym Kiosk oraz w widżecie Mini-Playera, które pozwalają jednym kliknięciem myszy przełączać skalę (% ↔ dB), a ekranowe OSD prezentuje poziom w wybranej jednostce.
- **Asynchroniczny eksport w tle z raportowaniem postępu i pływającym wskaźnikiem HUD**: Wprowadzono pełną asynchroniczność procesu transkodowania (`Transcoder::transcode_with_dsp_and_progress`), który co 150 ms sonduje pozycję potoku GStreamera i emituje zdarzenie `transcode_progress` do frontendu. Wyeliminowano wrażenie zamrożenia interfejsu — użytkownik otrzymuje natychmiastowe powiadomienie, interaktywny panel w oknie Ustawień z paskiem postępu i stoperem, oraz pływający wskaźnik HUD (`Floating Background Export Badge`) widoczny w całej aplikacji, który pozwala na swobodne słuchanie muzyki i korzystanie z biblioteki podczas renderowania.
- **GitHub Actions CI/CD Pipeline (`CI/CD Pipeline / Tests & Quality Checks`)**: Skonfigurowano automatyczny potok weryfikacji jakości kodu przy każdym Pull Requeście oraz pushu na gałęzie `main` i `dev`. Potok automatycznie sprawdza formatowanie Rust (`cargo fmt`), reguły lintera (`cargo clippy`), uruchamia testy (`cargo test`) oraz kompiluje frontend z walidacją typów TypeScript (`npm run build`).

### Poprawiono (Fixed)
- **Harmonic Queue Assistant & DJ Beat-Matched Crossfade**:
  1. *Synchronizacja stanu przycisków taktów (1/2/4 takty)*: Usunięto błąd, w którym modal sztywno inicjalizował przycisk `2 Takty (8 b)` jako fioletowy niezależnie od rzeczywistego czasu crossfade (np. 8000 ms), przez co użytkownik widział sprzeczny stan (`2 Takty` przy `8000 ms`), a kliknięcie nie przynosiło wizualnej reakcji. Wskaźnik aktywnego taktu jest teraz dynamicznie wyliczany na podstawie rzeczywistego czasu `crossfadeDurationMs` w stosunku do BPM.
  2. *Czytelne czasy na przyciskach taktów*: Na każdym przycisku (`1 Takt (4 b)`, `2 Takty (8 b)`, `4 Takty (16 b)`) wyświetlany jest rzeczywisty przeliczony czas trwania w sekundach (np. `• 1.9s`, `• 3.8s`, `• 7.5s` dla 128 BPM), a etykieta wyraźnie wskazuje powiązane tempo.
  3. *Eliminacja pustego stanu „Brak aktywnego utworu”*: Gdy odtwarzacz jest zatrzymany lub brak utworu z kolejki, modal automatycznie pozwala wybrać utwór referencyjny z biblioteki za pomocą listy wyboru (`Wybierz utwór bazowy do miksu`), umożliwiając natychmiastowe planowanie miksu i ranking harmoniczny Camelot bez konieczności wcześniejszego uruchamiania odtwarzania.
  4. *Automatyczna detekcja BPM i klucza*: Po otwarciu asystenta harmonicznego dla utworu bez metadanych Camelot/BPM aplikacja automatycznie w tle uruchamia precyzyjną analizę (`detect_track_key_bpm`), uzupełniając brakujące wartości.
  5. *Prawdziwe DJ Mix Now*: Przycisk *Mix Now* przy sugerowanym utworze nie wykonuje już twardego resetu kolejki, lecz wstawia utwór na początek kolejki (`add_next_to_queue`), opcjonalnie zestraja tempo DSP do BPM utworu docelowego i uruchamia natychmiastowe, płynne przejście beat-matched crossfade.
- **Pełne i płynne działanie Equal-Power Crossfade (0.0s – 8.0s) między utworami**: Usunięto błąd, w wyniku którego funkcja płynnego przejścia (Equal-Power Crossfade) nie działała poprawnie lub sprawiała wrażenie wyłączonej przy dłuższych czasach przejścia:
  1. *Usunięcie sztywnego limitu 3 sekund*: Wyeliminowano ograniczenie `crossfade_ms.min(3000) / 2`, które blokowało czas przejścia do maksymalnie 1.5s wyciszenia i 1.5s wejścia — teraz odtwarzacz w pełni respektuje suwak użytkownika aż do 8.00s (8000 ms).
  2. *Płynna mikrokosmetyka krzywej sinusoidalnej (20 ms)*: Zastąpiono skokowe, 6-krokowe schodki głośności (z rzędu 16% na krok) płynną modulacją ze skokiem 20 ms (50 Hz), eliminując wszelkie skoki, trzaski i artefakty przy zmianie utworu.
  3. *Eliminacja wyciszania ciszy i asynchroniczny preroll*: Wyciszenie pre-EOS następuje teraz płynnie pod koniec trwającego utworu (`duration - position <= crossfade_ms / 2`), a po osiągnięciu EOS następny utwór natychmiast rozpoczyna odtwarzanie i płynnie wchodzi (fade-in) w tle po zakończeniu prerollu buforów GStreamera (do 150 ms), co wyeliminowało długie pauzy martwej ciszy między utworami.
  4. *Asynchroniczne wejście bez blokowania UI*: Wyciszenie wejściowe nowego utworu działa w asynchronicznym wątku z tokenem generacji `fade_generation`, co całkowicie zniosło blokowanie wątku poleceń Tauri (przyciski Next/Previous oraz UI reagują natychmiast).
  5. *Wsparcie crossfade przy nawigacji po kolejce i playlistach*: Wdrożono płynny crossfade także przy bezpośrednim wyborze utworu z kolejki (`play_index`), zmianie zawartości kolejki (`set_queue`) oraz akcji *Mix Now* w asystencie harmonicznym.
- **Obsługa skrótów klawiaturowych (↑ / ↓ / Spacja) po kliknięciu myszką w suwak głośności**: Usunięto usterkę polegającą na blokowaniu globalnych skrótów odtwarzacza i przejmowaniu klawiszy strzałek przez natywny element DOM `<input type="range">` (krok 1% zamiast 5%) po uprzednim kliknięciu myszką w suwak głośności. Dodano automatyczne zwalnianie focusu (`blur`) na zdarzeniach `onPointerUp`/`onMouseUp`, ujednolicono rejestrację skrótów klawiaturowych w jednym globalnym słuchaczu i zagwarantowano, że skróty klawiszowe głośności (↑ / ↓) zawsze skokowo modyfikują głośność o 5% z wyświetleniem animowanego powiadomienia OSD.
- **Natywne poszerzanie bazy stereo (Stereo Widener / Stereo Stage) i eliminacja rwania dźwięku**: Zastąpiono wadliwy element GStreamera `stereo` (`gststereo.c` z pakietu `gst-plugins-good` posiadający wieloletni błąd pętli przetwarzający zaledwie 1/4 każdego bufora i porzucający 3/4 próbek, a ponadto wymuszający stratną konwersję do formatu S16LE) w pełni natywną sondą bufora `F32LE` bazującą na macierzy Mid-Side ($M/S$). Nowa implementacja działa bezalokacyjnie w 32-bitowym float bezpośrednio przed buforem `queue_sink`, oferuje płynne rozszerzanie bazy stereo z automatyczną kompensacją energii i ochroną przed cyfrowym przesterowaniem oraz całkowicie eliminuje trzaski, rwanie i skoki głośności na granicach buforów. Dodano także weryfikację `channels == 2` w pad caps, co chroni przed nieprawidłowym przetwarzaniem plików mono.
- **Kompatybilność testów urządzeń audio z bezgłowym CI**: W teście integracyjnym `test_device_manager_discovers_cards_and_codecs` dodano bezpieczną obsługę środowisk wirtualnych bez fizycznych kart audio (np. kontenery i GitHub Actions runners), zapobiegając fałszywym panicom na asercji liczby wykrytych kart.
- **Kolejność budowania w GitHub Actions CI/CD**: Naprawiono błąd paniki makra Tauri `tauri::generate_context!()` (`The frontendDist configuration is set to "../dist" but this path doesn't exist`) poprzez przestawienie kroków w potoku — kompilacja frontendu (`npm ci && npm run build`) jest teraz wykonywana przed sprawdzaniem lintera Rust (`cargo clippy`) oraz uruchamianiem testów (`cargo test`). Dodano także demona `pulseaudio` dla bezbłędnego uruchamiania testów dźwiękowych w bezgłowym środowisku CI.
- **Synchronizacja i nazewnictwo punktów pętli A-B przy eksporcie**: Usunięto błąd, w którym po ustawieniu nowych punktów pętli w odtwarzaczu formularz eksportu zachowywał stare wartości z poprzedniego eksportu. Dodano automatyczną synchronizację aktywnej pętli i nazwy pliku wyjściowego (`_loop_start-end`) przy wejściu do transkodowania oraz po zmianie punktów.
- **Kompleksowe tłumaczenie i wielojęzyczność interfejsu (i18n / English localization)**: Wyeliminowano pozostałe nieprzetłumaczone etykiety i teksty w języku polskim przy wybranym języku angielskim (`en`) i innych językach obcych. Przetłumaczono m.in. etykietę suwaka Stereo Widener („Szerokość sceny stereo:” → „Stereo width:”), opisy i status limitera, parametry pogłosu Freeverb, nazwy presetów korektora, powiadomienia toast i tooltips, pasek filtrowania fasetowego (`FacetsFilterPane`), stacje radiowe i ich opisy (`RadioView`), edytor pętli (`LoopEditorModal`), okno zapisu kolejki (`SaveQueueModal`), znaczniki utworu (`TrackBookmarksModal`) oraz modal dodawania stacji radiowych.
- **Obsługa przecinków i formatów czasu w polach eksportu**: Rozszerzono `parseTimeToMs` o obsługę przecinków dziesiętnych (np. `0:22,449`) oraz prefiksów `A:` i `B:`.
- **Układ zakładek ustawień (Tabs Tiling & Text Wrap)**: Dodano `whiteSpace: 'nowrap'` oraz `flexShrink: 0` do przycisków paska pod-zakładek okna Ustawień (`Themes & Appearance`, `Audio & Devices`, itd.). Eliminuje to niepożądane zawijanie tekstu na dwie linie i wychodzenie słów poza fioletowy obrys aktywnej zakładki na węższych ekranach oraz przy skalowaniu DPI.
- **Walidacja zakresu eksportu**: Poprawiono odblokowywanie przycisku eksportu w razie nieprawidłowej kolejności punktów (zapobieganie zawieszeniu w stanie ładowania).

### Zmieniono (Changed)
- Zapewniono automatyczne czyszczenie i odświeżanie sufiksów `_loop_...` w ścieżce docelowej transkodowania przy przełączaniu formatów oraz punktów cięcia.

### Wydajność i Architektura (Performance & Internal)
- Dodano test integracyjny `test_transcode_different_ranges_with_rubberband_slowed` weryfikujący precyzję cięcia kolejnych fragmentów A-B w potoku GStreamera z RubberBandem.
- Wyeliminowano potencjalny race-condition w `DiscordRpcController::set_enabled` i `set_client_id` poprzez natychmiastową synchronizację statusu w `RwLock`.

---

## [0.8.2] — „Pure Flow & Transcode Stability” - 2026-11-01
**Autorka**: Das Letzte Kemonomimi

### Poprawiono (Fixed)
- **Eliminacja awarii (SIGABRT/panic) przy edycji pasm w PEQ Studio**: naprawiono przekazywanie wartości wzmocnienia powyżej +12.0 dB do elementu GStreamera `equalizer-nbands`. GStreamer wymusza ścisły zakres właściwości `gain` od -24.0 dB do +12.0 dB; przekroczenie powodowało panikę w warstwie glib FFI i awarię aplikacji. Wprowadzono bezpieczne obcinanie `clamp(-24.0, 12.0)` w silniku audio oraz zsynchronizowano zakresy w domenie `crates/domain/src/parametric_eq.rs`.
- **Działanie pasm użytkownika i automatyczna aktywacja w PEQ**: usunięto błąd niezgodności formatu serializacji wariantów typów filtrów (`low-shelf` i `high-shelf` vs `snake_case` w Serde), przez który ręczne edycje pasm z filtrami Low Shelf / High Shelf były po cichu odrzucane na granicy Tauri IPC i nie wpływały na brzmienie potoku (działały jedynie fabryczne presety, które były generowane po stronie Rust). Wprowadzono pełną obsługę formatów kebab-case oraz aliasów snake-case/APO w warstwie domenowej Rust oraz normalizację w kodzie TypeScript. Dodatkowo bezpiecznie zarejestrowano typy GObject w potoku audio (`GST_INIT_ONCE`), a każda zmiana pasma automatycznie włącza korektor parametryczny (`enabled: true`) z wizualnym wskaźnikiem statusu.
- **Eliminacja zawieszenia (100% CPU deadlock) przy wyłączaniu ReplayGain ("Off")**: usunięto zapętloną rekurencję sygnałową w module `pipeline.rs`. Poprzednia implementacja przy przejściu na `ReplayGainMode::Off` modyfikowała właściwość `pre-amp` w odpowiedzi na powiadomienie `notify::target-gain`, co natychmiast wyzwalało ponowne przeliczenie `target-gain` i prowadziło do nieskończonej pętli ping-pong zawieszającej wątek aplikacji. Zamiast manipulacji wzmocnieniem, element wewnętrzny `rgvolume-volume` jest teraz bezpiecznie przełączany w tryb zero-overhead passthrough (`GstBaseTransform::set_passthrough(true)`), a limiter jest natywnie wyłączany.
- **Eliminacja zawieszenia przy eksporcie/transkodowaniu (plik 0 bajtów / nieskończony timeout)**: naprawiono blokowanie potoku transkodera przy eksporcie do formatu FLAC/Opus/WAV. Enkodery audio (zwłaszcza `flacenc`) wymagają próbek PCM o ściśle określonym formacie całkowitoliczbowym (S16/S24/S32); brak elementu `audioconvert` pomiędzy `audioresample` a enkoderem powodował utknięcie na etapie negocjacji capsów (plik wyjściowy pozostawał pusty z rozmiarem 0 bajtów, a potok nigdy nie emitował EOS). Dodano uniwersalny blok adaptacyjny `audioconvert + audioresample` bezpośrednio przed enkoderem, zabezpieczono pętlę magistrali bezpiecznym 180-sekundowym limitem czasu oraz przeniesiono wywołanie `transcode_file` do asynchronicznego wątku roboczego `tauri::async_runtime::spawn_blocking` ze wskaźnikiem ładowania i blokadą wielokrotnego kliknięcia w interfejsie.
- **Natywny silnik Rubber Band dla transkodera (eliminacja artefaktów SoundTouch)**: naprawiono potok transkodera, który dotychczas korzystał ze sztywno zakodowanego elementu GStreamera `pitch` (bazującego na silniku SoundTouch). Przy spowolnieniach (np. tempo 0.55x) algorytm WSOLA SoundTouch powodował słyszalne artefakty szatkowania i fazowania. Potok transkodera integruje teraz autorski element `AuraluneDsp` wykorzystujący natywny silnik Rubber Band z precyzyjną analizą transjentów i najwyższą jakością pitch-shiftingu (oraz dynamiczny wybór silnika zgodnie z aktualnym wyborem w odtwarzaczu).

### Zmieniono (Changed)
- Zaktualizowano skalę osi Y wykresu odpowiedzi częstotliwościowej oraz suwaki pasm w `ParametricEqModal.tsx` z -24..+24 dB do rzeczywistego zakresu filtrów GStreamera: -24..+12 dB.

### Wydajność i Architektura (Performance & Internal)
- Wdrożono trailing throttle (35 ms) dla wywołań Tauri IPC (`set_parametric_eq_state`) podczas płynnego przeciągania węzłów na wykresie SVG (eliminacja lawinowych 100+ wywołań na sekundę i obciążenia potoku audio).
- Zabezpieczono właściwość `num-bands` w potoku GStreamera przed zbędnym resetowaniem tablicy pasm przy identycznej liczbie pasm oraz ograniczono maksymalną liczbę pasm do 64.

---

## [0.8.1] — „Parametric Warmth & Studio Dynamics” - 2026-11-01
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Wielopasmowy Korektor Parametryczny (Parametric EQ Studio)**:
  - Architektura procesora PEQ w domenie (`crates/domain/src/parametric_eq.rs`) obsługująca dowolną liczbę pasm (od 1 do 32) z filtrami: Peak (dzwonowy), Low Shelf (półkowy dolny) oraz High Shelf (półkowy górny), z precyzyjną regulacją dobroci $Q$ oraz szerokości pasma.
  - Wbudowany algorytm kalkulacji bezpiecznego wzmocnienia przedwzmacniacza (**Safe Preamp / Headroom Protection**), automatycznie wyliczający ujemny offset wzmocnienia, aby uniemożliwić cyfrowe przesterowanie (clipping) sygnału audio przy podbiciach pasm.
  - Kompletny parser i eksporter konfiguracji **EqualizerAPO / AutoEQ** w formacie tekstowym `.txt` (`parse_equalizer_apo` oraz `export_to_equalizer_apo`), umożliwiający import profili słuchawkowych i głośnikowych z forów audiofilskich oraz zewnętrznych baz pomiarowych.
  - Fabryczne presety brzmieniowe: *Harman Target Baseline (Krzywa Harmana)*, *Vocal Clarity & Air*, *Sub-Bass Punch & Rumble*, *De-Esser (Sibilance Control)* oraz *Flat (Neutral)*.
  - Nowe komendy Tauri: `get_parametric_eq_state`, `set_parametric_eq_state`, `set_parametric_eq_enabled`, `set_parametric_eq_preamp`, `get_parametric_eq_presets`, `parse_equalizer_apo_config`, `export_equalizer_apo_config`.
  - Dedykowany, luksusowy interfejs anime glassmorphism `ParametricEqModal.tsx` wyposażony w interaktywny wykres odpowiedzi częstotliwościowej (krzywa biquad oparta o Audio EQ Cookbook Roberta Bristowa-Johnsona), skalę logarytmiczną 20 Hz – 20 kHz, przeciągane węzły pasm (drag & drop), wskaźnik headroomu i cyfrowego clippingu, szafę parametrów pasm oraz okno dialogowe importu/eksportu EqualizerAPO.
  - Integracja ze skrótem w Palecie Komend (Ctrl+K -> `Korektor Parametryczny (PEQ Studio)`) oraz szybkim przyciskiem w zakładce DSP z dynamiczną diodą stanu.
  - Wielojęzyczne tłumaczenia dla interfejsu PEQ Studio (PL, EN, DE, FI, LA).
- **Studio Kompresora & Nasycenia Analogowego (Dynamics & Warmth Studio)**:
  - Architektura procesora dynamiki w domenie (`crates/domain/src/dynamics.rs`) zintegrowana z kompresorem dynamiki (DRC), emulacją nasycenia lampowego/taśmowego oraz sprzętowym limiterem słuchawkowym.
  - Kompresor dynamiki oparty o element GStreamera `audiodynamic` z regulacją progu (`threshold_db`, -60 do 0 dBFS), stosunku kompresji (`ratio`, 1:1 do 20:1), przełączaniem charakterystyki kolana (Soft-Knee vs Hard-Knee) oraz wzmocnieniem wyrównawczym (Makeup Gain od 0 do +24 dB).
  - Silnik nasycenia analogowego i ciepła lampowego (Analog Tube & Tape Saturation) wykonujący bezalokacyjne przekształcenia nieliniowe (waveshaping) na próbkach F32LE bezpośrednio w sondzie bufora potoku (`gst::PadProbeType::BUFFER`):
    - *Lampa Elektronowa (Tube Warmth / Triode)* — asymetryczne nasycenie generujące przyjemne dla ucha parzyste harmoniczne (2nd harmonic) i ciepły, miękki bas;
    - *Taśma Analogowa (Tape Saturation)* — symetryczna kompresja szczytów fali audio zaokrąglająca ostre soprany i dająca analogową gęstość taśmy;
    - *Overdrive Harmoniczny* — nasycenie hiperboliczne ożywiające utwory lo-fi i dynamiczne anime rock OP.
  - Fabryczne presety brzmieniowe: *Vintage Tube Amplifier*, *Warm Analog Tape Deck*, *Anime Broadcast & Radio*, *Lo-Fi Crunchy Vinyl*, *Headphone Hearing Protection* oraz *Direct Bypass*.
  - Nowe komendy Tauri: `get_dynamics_state`, `set_dynamics_state`, `set_compressor_enabled`, `set_saturator_enabled`, `get_dynamics_presets`.
  - Interaktywny, luksusowy interfejs modalny `DynamicsStudioModal.tsx` w estetyce anime glassmorphism z dynamicznymi wykresami SVG odpowiedzi kompresora i nieliniowej krzywej transferu $f(x)$ falowego saturatora.
  - Integracja z zakładką DSP (przycisk *Dynamics Studio* z podwójną diodą aktywności) oraz Paletą Komend (Ctrl+K).

### Zmieniono (Changed)
- Rozszerzono `PlaybackStatusDto` oraz stan odtwarzacza o pola `parametric_eq_enabled`, `compressor_enabled`, `saturator_enabled` oraz `limiter_enabled`.

### Wydajność i Architektura (Performance & Internal)
- Wpięto dynamiczny łańcuch `peq_preamp` (`volume`) oraz `peq_equalizer` (`equalizer-nbands`) w potok GStreamera z dynamiczną manipulacją pasm w czasie rzeczywistym poprzez `gst::ChildProxy` bez trzasków i przerw w odtwarzaniu bit-perfect.
- Wpięto łańcuch `compressor` (`audiodynamic`) -> `compressor_makeup` (`volume`) -> `saturator` (`identity` z sondą F32LE) z trybem zerowego obciążenia CPU (bit-perfect `set_passthrough(true)` oraz natychmiastowym pomijaniem sondy, gdy moduły są wyłączone).
- Dodano zestaw testów jednostkowych i integracyjnych: `crates/audio-engine/tests/dynamics_test.rs`, `crates/audio-engine/tests/parametric_eq_test.rs` oraz testy w `crates/domain/src/dynamics.rs` i `crates/domain/src/parametric_eq.rs`.

---

## [0.8.0] — „Harmonic Flow & Ambient Focus” - 2026-11-01
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Dźwiękowy generator tła (Soundscape / Lofi Ambience)**:
  - Proceduralny silnik syntezy Web Audio API w czasie rzeczywistym z 5 niezależnymi, nieskończonymi warstwami otoczenia:
    1. *Deszcz (Rain)*: szum różowy filtrowany dolnoprzepustowo z modulacją LFO i losowymi kroplami deszczu.
    2. *Winyl (Vinyl crackle)*: trzaski igły gramofonowej i szum powierzchniowy płyty winylowej.
    3. *Ognisko (Campfire)*: głęboki szum brązowy z trzaskającymi iskrami drewna.
    4. *Wiatr i dzwonki Furin (Wind & Chimes)*: podmuchy wiatru z tradycyjnymi japońskimi dzwonkami wiatrowymi Insen/Hirajoshi.
    5. *Kawiarnia / Szum brązowy (Cafe & Brown Noise)*: głęboki szum o nachyleniu 6 dB/oktawę ułatwiający skupienie i naukę.
  - Zestaw gotowych presetów: *Lofi Study ☕*, *Rainy Tokyo 🌧️*, *Sakura Garden 🌸*, *Warm Hearth 🔥*, *Deep Focus 🎧*.
  - Automatyczna synchronizacja z efektami cząsteczkowymi tła anime (Sakura, Deszcz, Iskry).
  - Płynny mikser suwakowy w szklanym oknie modalnym, wyciszanie (mute) oraz zapamiętywanie poziomów w `localStorage`.
- **Harmonic Queue Assistant & DJ Beat-Matched Crossfade**:
  - Inteligentne miksowanie harmoniczne oparte na kole Camelota (Camelot Wheel) i algorytmie dopasowania Mixed In Key.
  - Wykrywanie stopnia harmoniczności: ten sam klucz (100%), zmiana nastroju molowy/durowy (95%), kroki energii ±1 (90%), kroki po przekątnej (85%), modulacja energii semitonowej (+1 semiton / +7 godzin na kole, 80%).
  - Precyzyjne dopasowanie tempa BPM z tolerancją standardu DJ-skiego (±6%) oraz detekcją half-time / double-time (np. 70 BPM <-> 140 BPM, 175 DnB <-> 87.5 Halftime).
  - Dynamiczny **DJ Beat-Matched Crossfade**: obliczanie i aplikowanie czasu przenikania równego 1 taktowi (4 beaty), 2 taktom (8 beatów) lub 4 taktom (16 beatów) aktualnego tempa BPM.
  - Działania jednym kliknięciem: natychmiastowe płynne przejście z crossfade (*Mix Now*), kolejkowanie jako następny utwór (*Play Next*), dodawanie do kolejki oraz funkcja *Sync BPM* dopasowująca suwak tempa silnika DSP do sugerowanego utworu.
- **Baza profili słuchawkowych AutoEQ (1-klikowy Parametric EQ)**:
  - Baza ponad 160 precyzyjnych profili pomiarowych słuchawek nausznych, wokółusznych i dokanałowych IEM od wiodących marek: Moondrop (Chu, Chu II, Aria, Kato, Blessing 2/3, Dusk, Variations), Sennheiser (HD 600, HD 650/6XX, HD 560S, HD 800 S, IE 200/600), Beyerdynamic (DT 770 Pro 80/250, DT 990 Pro, DT 1990 Pro), Sony (WH/WF-1000XM4/XM5, MDR-7506), Apple (AirPods Pro 2, AirPods Max), Hifiman (Sundara, Edition XS, Arya, Ananda), Truthear (Zero:RED, Hexa, Nova), AKG (K371, K240, K702), Tangzu, 7Hz, Koss, Bose i innych.
  - Skalowanie do 10-pasmowego korektora graficznego Auralune (31 Hz - 16 kHz) z kompensacją krzywej Harmana (Harman Over-Ear 2018 / Harman In-Ear 2019v2).
  - Wbudowana ochrona przed przesterowaniem (cyfrowy clipping) dzięki zalecanemu tłumieniu Preamp.
  - Wygładzona wizualizacja krzywej korekcji w modalnym panelu, wyszukiwarka modeli oraz natychmiastowe zastosowanie jednym kliknięciem.

### Zmieniono (Changed)
- Zintegrowano mikser Soundscape, Harmonic Suggester oraz bazę AutoEQ w menu narzędziowym nagłówka, sekcji korektora DSP oraz w palecie komend (Ctrl+K).
- Dodano wielojęzyczne tłumaczenia (PL, EN, DE, FI, LA) dla nowych funkcji miksowania i korekcji.

### Wydajność i Architektura (Performance & Internal)
- Silnik Soundscape wykorzystuje zerowe narzuty I/O dzięki syntezie proceduralnej w pamięci podręcznej Web Audio API (automatyczne zawieszenie AudioContext, gdy wszystkie kanały są wyłączone, redukujące zużycie procesora do 0%).
- Zoptymalizowano indeksowanie i wyszukiwanie kandydatów harmonicznych przy użyciu `useMemo` i wektoryzacji odległości koła zegarowego.

---

## [0.7.7] — „Precision Loop & Seamless Flow” - 2026-11-01
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Precyzyjne kolejkowanie pojedynczych utworów (`Single-Track Playback`)**:
  - Kliknięcie utworu w tabeli biblioteki, wynikach wyszukiwania, palecie komend (Ctrl+K) lub modalach statystyk odtwarza wyłącznie ten konkretny utwór (zakładając 1-elementową kolejkę w trybie `replace` lub dodając go na koniec w trybie `append`), eliminując niepożądane pakowanie całej 3-tysięcznej biblioteki do kolejki.
- **Stały dolny pasek odtwarzacza w widoku Odtwarzacza (Now Playing Dock)**:
  - Gdy użytkownik przewija dużą kolejkę lub widok odtwarzacza w dół, dolny pasek ze sterowaniem (Play/Pause, Next/Prev, suwak czasu, głośność, okładka) automatycznie pojawia się na dole ekranu, uniemożliwiając utratę kontroli nad odtwarzaniem. Dodano także 1-klikowy powrót na samą górę (`Scroll to Top`).

### Poprawiono (Fixed)
- **Precyzja eksportu fragmentu A-B z włączonym DSP (Nightcore/Slowed/Tempo/Rate)**:
  - Wykonywanie seeka w potoku transkodera GStreamera przeniesiono bezpośrednio na element `audioresample` przed filtrem DSP `pitch`.
  - Wyeliminowano błąd, w którym filtr `pitch` mnożył punkty A i B przez współczynnik tempa i szybkości (`tempo * rate`), przesuwając początek i koniec wycinka (np. 1.25x dalej w Nightcore lub ucinając za wcześnie w Slowed). Po poprawce fragment A-B jest precyzyjnie wycinany w bezwzględnej osi czasu pliku źródłowego z dokładnością co do próbki.
- **Eliminacja zalewania kolejki biblioteką (3k utworów) i naprawa 3 trybów kolejkowania (`albumPlaybackMode`)**:
  - Wyeliminowano przekazywanie `sortedTracks` do wierszy tabeli biblioteki.
  - Naprawiono i ujednoznaczniono 3 tryby w *Ustawienia -> Audio i Odtwarzacz*:
    - `replace`: Zastępuje kolejkę wybranym albumem/playlistą (lub tylko 1 klikniętym utworem/plikiem).
    - `append`: Dopisuje kliknięty album/playlistę lub 1 utwór/plik na koniec kolejki.
    - `single`: Odtwarza bezpośrednio kliknięty utwór/plik bez modyfikowania kolejki.
    - Otwieranie plików z systemu (`pick_files`) oraz przyciski dodawania do kolejki (`+`) respektują wybrane zasady.
- **Precyzja wirtualizacji kolejki (Virtual Scroll) i odporność wyboru utworu (`play_queue_index`)**:
  - Skorygowano wysokość wiersza `itemHeight` (72px standard / 54px compact) oraz wyliczanie `offsetTop` tabeli przez `getBoundingClientRect()`, likwidując kumulacyjny błąd przesunięcia pozycji przy przewijaniu.
  - Dodano opcjonalny parametr `expected_id` do komendy backendu `play_queue_index`, weryfikujący zgodność ID klikniętego wiersza z kolejką silnika audio, zapobiegając odtworzeniu przesuniętego lub innego utworu.

---

## [0.7.5] — „Single Flow & Harmonic Resonance” - 2026-11-01
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Architektura Single-Instance i obsługa otwierania plików z menedżera (IPC)**:
  - Zintegrowano oficjalny plugin `tauri-plugin-single-instance`, zapobiegając uruchamianiu wielu równoległych instancji i okien Auralune przy otwieraniu plików audio (np. wielokrotnym klikaniu plików w Dolphinie, Nautilusie, Thunarze czy Nemo).
  - Wprowadzono automatyczne przywracanie i aktywowanie istniejącego okna (`unminimize`, `show`, `set_focus`), gdy użytkownik otwiera plik z zewnątrz.
  - Zaimplementowano bezpieczny parser argumentów CLI i protokołów (`file://` z obsługą dekodowania URL oraz relatywnych ścieżek `cwd`), przekazujący otwierane utwory bezpośrednio do aktywnej instancji odtwarzacza.
  - Dodano emisję zdarzenia `queue_changed` z backendu do frontendu, dzięki czemu kolejka w interfejsie natychmiast odświeża się po otwarciu pliku z zewnątrz.
- **Konfigurowalne zachowanie odtwarzania albumów i playlist**:
  - Dodano opcję w *Ustawienia -> Audio i Odtwarzacz* (`albumPlaybackMode` zapisywany w `localStorage` oraz w bazie SQLite):
    - `replace` (domyślny): kliknięcie „Odtwórz album” lub utworu z albumu/playlisty (albo pliku z zewnątrz) zastępuje kolejkę i rozpoczyna odtwarzanie od wskazanego numeru, umożliwiając naturalne działanie autoplay (EOS) oraz przycisków „Dalej / Poprzedni” (Skip).
    - `append`: dodaje utwory na koniec istniejącej kolejki.
    - `single`: ładuje wyłącznie pojedynczy kliknięty utwór (bez modyfikacji kolejki).
  - Dodano pełne tłumaczenia dla wszystkich 5 języków (`pl`, `en`, `de`, `fi`, `la`).

### Poprawiono (Fixed)
- **Odtwarzanie albumów i Autoplay**: Naprawiono błąd, w którym kliknięcie „Odtwórz album” lub utworu w widoku albumu/playlisty odtwarzało tylko pojedynczą piosenkę bez wypełniania kolejki (`queue`), przez co zdarzenie końca utworu (GStreamer EOS) nie przechodziło do następnego utworu, a przycisk „Dalej” (Next / Skip) nie reagował.
- **Live FFT Spectrum Visualizer**: Rozwiązano problem „martwych/płaskich” słupków wyższych częstotliwości w analizatorze widma:
  - Zwiększono rozdzielczość FFT GStreamera z 16 liniowych pasm do 64 pasm, dodając algorytm logarytmicznego grupowania (`log_pool_to_16_bands`) zgodny z ludzką percepcją słuchu (od sub-basu 30 Hz do tonów wysokich 20 kHz).
  - Obniżono próg czułości (`threshold`) z -60 dBFS do -75 dBFS oraz wprowadzono czułą nieliniową normalizację decybeli.
  - Przepięto element `spectrum` przed element `volume` w potoku audio (`rgvolume -> rglimiter -> spectrum -> volume`), dzięki czemu wizualizer zachowuje pełną dynamikę i nie zamiera przy słuchaniu na niskim poziomie głośności.
  - Zaimplementowano `Drop for PipelineInner` (automatyczne przestawianie potoku do `Null` przy zwalnianiu zasobów), zapobiegając ostrzeżeniom GStreamera i błędom pamięci podczas zamykania.

### Zmieniono (Changed)
- **SpectrumVisualizer (Frontend)**: Zaktualizowano krzywą dynamiki i usunięto sztuczne podbijanie zerowych pasm w spoczynku, zapewniając żywy taniec słupków we wszystkich trybach wizualizacji (Bars, Retro, Wave, Anime Circle, Oscilloscope, Mirrored).

---

## [0.7.4] — „Presence & Recap Harmony” - 2026-10-31
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Kompatybilność z Bazzite, SteamOS i dystrybucjami immutable (`auralune-bazzite`)**:
  - Dedykowana paczka AppImage (`Auralune_0.7.4_bazzite_amd64.AppImage`) przygotowana w hermetycznym środowisku kontenerowym ze zlinkowanymi wersjami bibliotek kompatybilnymi z Bazzite / Fedora Atomic Desktop (eliminacja konfliktu GLIBC_2.44 i brakujących symboli w webkit2gtk/glibc).

### Poprawiono (Fixed)
- **Discord Rich Presence (RPC) & zapętlanie utworów (Repeat / Loop)**:
  - Wyeliminowano zatrzymywanie się paska postępu utworu na końcu (np. `1:48 / 1:48`) przy włączonym powtarzaniu (`Repeat Track`, `Repeat All`, pętla A-B).
  - Wprowadzono zdarzenie `PlayerEvent::TrackLooped`, śledzenie wstecznego skoku pozycji odtwarzacza oraz weryfikację czasu trwania w `DiscordRpcWorker`, co gwarantuje natychmiastowe zresetowanie timestampów Discorda do `0:00` i prawidłowy licznik przy każdym zapętleniu.
- **Auralune Recap (Wrapped)**:
  - Naprawiono formatowanie sumarycznych statystyk odtwarzania (likwidacja etykiet `NaN min` i zerowych liczników utworów).
  - Skorygowano zapytania bazy SQLite dla najczęściej odtwarzanych utworów (Top Tracks) i wykonawców (Top Artists) oraz dodano fallbacki do bazy utworów przy nowo utworzonych bibliotekach.

---

## [0.7.3] — „SoundCloud & Playlist Harvester” - 2026-10-31
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Rozbudowany importer audio URL (filtry jakości i bitrate)**:
  - Wybór profilu jakości / bitratu FFmpeg dla formatów stratnych: MP3 (320 kbps CBR Studio, 256 kbps CBR, 192 kbps CBR, V0 VBR ~245 kbps), OPUS (160 kbps Studio Transparent, 128 kbps Standard, 96 kbps Kompakt), M4A/AAC (256 kbps iTunes Plus, 192 kbps, 128 kbps) oraz bit-perfect FLAC bezstratny.
- **Pobieranie całych playlist, albumów i kanałów SoundCloud**:
  - Przełącznik zbiorczego pobierania linków wieloutworowych (`--yes-playlist`) dla SoundCloud (utwory, sety, profile i playlisty), YouTube, Bandcamp itp.
  - Opcjonalny limit liczby pobieranych utworów (Bez limitu, 5, 10, 25, 50, 100).
  - Wybór układu katalogów docelowych w stylu foobar2000 (podfolder playlisty/albumu `[Folder]/[01 - Tytuł]`, hierarchia artysta/album `[Wykonawca]/[Album]/[01 - Tytuł]` lub płaski katalog).
- **Widok przeglądu pobranej playlisty (Multi-track Review)**:
  - Ekran podsumowania z listą wszystkich pobranych utworów, czasami trwania, formatem, przyciskami natychmiastowego odtworzenia wszystkich („Odtwórz wszystkie”), zakolejkowania całości („Dodaj wszystkie do kolejki”) oraz jednostkowymi kontrolkami odtwarzania per utwór.

### Poprawiono (Fixed)
- Obsłużono kod wyjścia 101 w `yt-dlp` (`MaxDownloadsReached`) jako kontrolowany sukces pobierania przy ustawionym limicie `--max-downloads`.
- Zapewniono odporne rekurencyjne wykrywanie nowo pobranych plików w katalogach potomnych oraz automatyczne zbiorcze indeksowanie w SQLite (`scan_paths`).

---

## [0.7.2] — „Stream Harvester & Precision Playback” - 2026-10-31
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Wbudowany legalny importer audio z URL (`yt-dlp`)**:
  - Dedykowany, nowoczesny modal w stylu anime-glassmorphic umożliwiający wklejenie linku (YouTube, SoundCloud, Bandcamp, Mixcloud, podcasty, pliki direct audio).
  - Automatyczne wyodrębnianie ścieżki dźwiękowej w wybranym formacie (studyjny FLAC, MP3 320 kbps, OPUS, M4A) z osadzaniem miniatury wideo jako okładki albumu oraz tagów metadanych ID3/Vorbis.
  - Natychmiastowe zindeksowanie pobranego utworu w lokalnej bazie SQLite biblioteki Auralune bez konieczności restartu aplikacji.
  - Szybkie akcje po pobraniu: „Odtwórz teraz”, „Dodaj do kolejki”, „Pokaż w folderze” oraz pobieranie kolejnych utworów.
  - Bezpieczne wywołanie procesu `yt-dlp` bez wstrzykiwania powłoki (czysty wektor argumentów) z czytelnym komunikatem o instalacji w razie braku binarki w systemie.
- **Przełącznik „Stop After Current Track” (Zatrzymaj po bieżącym utworze)**:
  - Klasyczna funkcja z foobar2000 pozwalająca zaplanować czyste zatrzymanie odtwarzacza po zakończeniu bieżącego utworu (idealne przed snem lub odejściem od komputera).
  - Dostępna bezpośrednio na dolnym docku odtwarzacza (obok Loop i Shuffle), w nagłówku kolejki oraz w palecie komend (Ctrl+K).
  - Po dojściu do końca utworu potok audio natychmiast zatrzymuje się, a flaga automatycznie resetuje do stanu nieaktywnego.

### Poprawiono (Fixed)
- Pełna synchronizacja stanu `stop_after_current` pomiędzy backendem Rust a wszystkimi kontrolkami interfejsu React.

---

## [0.7.1] — „Gothic Embers & Loop Integrity” - 2026-10-31
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Anulowanie nakładki przeciągania plików (Cancelable Drag & Drop Overlay)**:
  - Przycisk zamykający (`X`), obsługa klawisza `Escape` oraz kliknięcie w tło nakładki umożliwiają natychmiastowe wycofanie się z widoku upuszczania plików.
- **Czytelne tytuły i stacje w Anime Radio**:
  - Wyświetlacz odtwarzacza, pasek dolny, Mini Player oraz widok Kiosk wyświetlają przyjazną nazwę wybranej stacji radiowej oraz czyste metadane na żywo (`cleanLiveTitle`), eliminując surowe hashe i mount pointy Icecast (np. `xwa8ckz7mzzuv`).

### Poprawiono (Fixed)
- **Poprawka zapętlania utworów (Repeat Track / Loop)**:
  - Naprawiono problem, w którym utwór po dojściu do końca (EOS) odtwarzał się w ciszy na pustym potoku, dopóki pasek nie przeszedł całego utworu. Przejście potoku GStreamer do stanu `State::Null` przy restarcie utworu poprawnie resetuje flagę `sink->eos` w nielu PipeWire/GStreamer.
- **Ochrona kolejki użytkowniczki przed automatycznym nadpisywaniem**:
  - Kliknięcie pojedynczego utworu w bibliotece ani przeciągnięcie folderu/plików nie zastępuje i nie zanieczyszcza już manualnej kolejki odtwarzania. Do kolejki trafiają wyłącznie pozycje dodane jawnie przez użytkowniczkę przyciskiem „+” lub „Dodaj do kolejki”.
- **Zliczanie odtworzeń i statystyk przy pętlach i krótkich utworach**:
  - Zaimplementowano detekcję cofnięcia pozycji (`loop rewind`), dzięki czemu odsłuchania i statystyki zliczają się poprawnie przy każdym obiegu zapętlenia `Repeat Track`.
  - Zoptymalizowano próg zaliczenia odtworzenia dla krótkich utworów (`Math.min(15000, duration * 0.5)`).
- **Koegzystencja Discord Rich Presence z grami**:
  - Wyeliminowano spamowanie ramkami `SET_ACTIVITY` co 15 sekund przy odświeżaniu statystyk i metadanych. Dzięki temu Discord nie kasuje statusu aktywnej gry (np. Corpse Factory) i wyświetla obie aktywności jednocześnie.
- **Wyeliminowanie fałszywego okna dropu przy wewnętrznym drag & drop**:
  - Przeciąganie elementów interfejsu wewnątrz okna (np. zmiana kolejności utworów w kolejce) nie wywołuje już pełnoekranowej nakładki importu plików.
- **Odporność na freeze podczas skanowania biblioteki**:
  - Dodano 15-sekundowy `busy_timeout` w SQLite i przekształcono komendy pobierania biblioteki na natywne `async fn`, zapobiegając zawieszaniu się aplikacji (`Not Responding`) przy jednoczesnym odtwarzaniu i indeksowaniu plików.

---

## [0.7.0] — „Gothic Embers & Verehrt 1999” - 2026-10-31
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Gotycki motyw i estetyka In Extremo 1999 (Gothic In Extremo 1999)**:
  - Nowy, siódmy wbudowany motyw `gothic-in-extremo` („Gothic 1999 (In Extremo)”) zainspirowany kultowym albumem *Verehrt und Angespien* z 1999 roku oraz utworem *Herr Mannelig*.
  - Paleta kolorystyczna: głęboka czerń obsydianu (`#080507`), kute żelazo i kamień krypt (`rgba(22, 13, 17, 0.88)`), panele ze stali (`rgba(28, 15, 21, 0.75)`), akcenty krwi i karmazynu (`#e11d48`), burgund (`#881337`), żar pochodni (`#f97316`), antyczne złoto i mosiądz (`#d97706`), oraz jasny runiczny pergamin (`#fef2f2`).
  - Automatyczna migracja i seeding motywu w bazie SQLite przez `crates/storage`.
  - Nowy tryb efektów cząsteczkowych otoczenia `AnimeAmbienceFX` — **Płonące Iskry / Embers 🔥**: wznoszące się w górę, pulsujące żarem iskry ognia z pochodni i palenisk z poświatą i subtelnym znoszeniem przez wiatr.
  - Szybki dostęp do efektu iskier w nagłówku oraz z poziomu palety komend Ctrl+K.
- **Elastyczny układ biblioteki albumów (Album Grid & List Layout)**:
  - Naprawiono problem z przeskalowanymi, zbyt wielkimi kartami albumów — wprowadzono responsywną siatkę `repeat(auto-fill, minmax(...))` z maksymalnym limitem szerokości kafelka.
  - Przełącznik widoku: **Siatka (Grid)** z 3 rozmiarami kafelków (**S** — 140px, **M** — 190px, **L** — 250px) oraz **Lista (List)** z czytelnymi, zwartymi wierszami (okładka, tytuł, wykonawca, rok, liczba utworów, łączny czas trwania i przyciski szybkiej akcji Odtwórz / Dodaj do kolejki).
  - Filtr statusu okładki: *Wszystkie*, *Z okładką* oraz *Bez okładki*.
  - Rozszerzone sortowanie albumów o liczbę utworów oraz łączny czas trwania (oprócz tytułu, wykonawcy i roku wydania).
  - Trwałe zapamiętywanie wybranego trybu widoku i rozmiaru kafelków w `localStorage`.
- **Ręczna konfiguracja bufora audio i rozmiaru bloku DSP w Ustawieniach**:
  - Manualna regulacja bufora wyjściowego audio (`buffer_time_ms`, zakres 10–250 ms) oraz rozmiaru bloku procesora DSP (`dsp_block_size`, 256–8192 próbek).
  - Przycisk przywracania wartości domyślnych (Default: 40 ms PipeWire, 2048 próbek DSP).
  - Natychmiastowe zastosowanie zmian w działającym silniku potoku GStreamer / PipeWire bez konieczności restartu odtwarzacza.
- **Dedykowane kontrolki na dolnym pasku odtwarzacza (Bottom Player Bar)**:
  - Przyciski **Shuffle (Losowo)** oraz **Loop (Pętla: Wyłączona / Cała kolejka / Bieżący utwór)** z wyraźnymi stanami aktywnymi i kolorami akcentu.
  - Szybki przełącznik silnika DSP typu split-button (Bypass / Rubber Band / SoundTouch) z menu kontekstowym pozwalającym na natychmiastową zmianę silnika jednym kliknięciem bez opuszczania widoku odtwarzania.
- **Obsługa arkuszy CUE Sheet (.cue)**:
  - Natywny parser arkuszy dyrektyw CUE w `crates/domain/src/cue.rs` (obsługa `FILE`, `TRACK`, `INDEX 01`, `TITLE`, `PERFORMER`).
  - Modal `CueSheetModal.tsx` umożliwiający przeglądanie poszczególnych indeksów utworu, bezpośrednie odtwarzanie wybranego utworu z pliku-kontenera (FLAC/WAV/APE) oraz dodawanie ścieżek CUE do kolejki odtwarzania.
- **Pływające powiadomienie głośności (Volume OSD)**:
  - Elegancki wskaźnik HUD na środku ekranu pojawiający się podczas regulacji głośności kółkiem myszy lub klawiaturą z automatycznym łagodnym wygaszeniem.
- **Rejestr zmian roboczych (`CHANGELOG_PENDING.md`)**:
  - Dedykowany plik stagingowy w repozytorium, w którym agenci i deweloperzy na bieżąco rejestrują wprowadzane zmiany przed ich publikacją w oficjalnym changelogu.

### Zmieniono (Changed)
- **Uporządkowanie nagłówka aplikacji i sekcja About**:
  - Uproszczono lewy górny nagłówek odtwarzacza: pozostawiono czysty glif Kitsune, nazwę Auralune oraz wskaźnik wersji nad logo.
  - Wyczerpujące opisy, manifest misji, technologie i podziękowania przeniesiono do dedykowanej sekcji **O aplikacji (About)** w Ustawieniach.
- Zaktualizowano wersję projektu do `0.7.0` we wszystkich plikach repozytorium (`Cargo.toml`, `package.json`, `tauri.conf.json`, `install.sh`, `PKGBUILD`, `PKGBUILD-bin`, `.SRCINFO`, `README.md`, `README.pl.md`, `App.tsx`, `ChangelogView.tsx`).

---

## [0.6.5] — „Anime Web Radio, Live ICY Streams & Universal Installer” - 2026-10-26
**Autorka**: Das Letzte Kemonomimi

### Dodano (Added)
- **Anime Web Radio / Stacje Internetowe (Live ICY Streams & PipeWire DSP)**:
  - Dedykowana zakładka „Radio” (`RadioView.tsx`) zintegrowana z natywnym silnikiem odtwarzacza GStreamer / PipeWire.
  - Przechwytywanie metadanych ICY na żywo (`PlayerEvent::Tag` w `pipeline.rs`) ze strumieni Icecast/Shoutcast — tytuł aktualnie nadawanego utworu jest w czasie rzeczywistym aktualizowany w interfejsie (`live_stream_title`), na pasku Now Playing, w doku mini-playera, powiadomieniach MPRIS D-Bus oraz statusie aktywności Discord Rich Presence.
  - Wbudowane polecane stacje radiowe o wysokiej jakości: *LISTEN.moe J-Pop*, *LISTEN.moe K-Pop*, *Gensokyo Radio (Touhou Project)*, *Nightwave Plaza (Vaporwave / Future Funk)*, *AnimeNfo Radio* oraz *Lofi Beats Radio*.
  - Modal `AddRadioStationModal` umożliwiający dodawanie własnych strumieni internetowych z walidacją URL i persystencją w `localStorage`.
  - Pełne wsparcie efektów DSP czasu rzeczywistego (pitch-shifting Rubber Band / SoundTouch, tempo, korektor 10-pasmowy, pogłos i crossfeed słuchawkowy) bezpośrednio na strumieniach radiowych.
- **Zarządzanie Kolejką: Zapisz kolejkę jako nową playlistę (Save Queue as Playlist)**:
  - Nowe atomowe polecenie Tauri `save_queue_as_playlist(name: String)` tworzące nową playlistę w bazie SQLite i przepisujące do niej całą aktualną zawartość kolejki.
  - Przycisk `BookmarkPlus` w nagłówku kolejki odtwarzania oraz modal `SaveQueueModal` z polem nazwy, licznikiem utworów i natychmiastowym odświeżeniem listy playlist.
- **Uniwersalny instalator Linux (`install.sh`)**:
  - Samodzielny instalator działający na dowolnej dystrybucji Linuksa (Ubuntu, Debian, Fedora, Arch Linux, openSUSE, Void, NixOS, SteamOS itp.).
  - Instalacja w przestrzeni użytkownika (`~/.local/bin`, `~/.local/share`) bez konieczności uprawnień roota.
  - Automatyczne tworzenie skrótu w menu programów (`auralune.desktop`) wraz z kompletem ikon hicolor (128x128 oraz 512x512) i skojarzeniami typów MIME dla plików audio.
  - Zintegrowany launcher obsługujący transparentny fallback `--appimage-extract-and-run` w przypadku braku systemowego FUSE 2 (`libfuse.so.2`).
  - Opcja czystego odinstalowania (`install.sh --uninstall`).

---

## [0.6.4] — „foobar2000 Power Tools & Kitsune Facets” - 2026-10-26
**Autorka**: Das Letzte Kemonomimi

### Poprawiono (Fixed)
- **Deterministyczne zachowanie Kolejki Odtwarzania (Queue)**:
  - Kliknięcie przycisku „Play” (w bibliotece utworów, na kartach albumów, wykonawców, w wyszukiwaniu oraz playlistach) odtwarza wyłącznie wskazany utwór i nie nadpisuje kolejki odtwarzania.
  - Dodano dedykowane przyciski `+` („Dodaj do kolejki”) dla albumów, wykonawców, playlist i nagłówka wyszukiwania, korzystające ze zoptymalizowanego zbiorczego zapytania `add_uris_to_queue`.
  - Wyeliminowano sztuczne generowanie kolejki i automatyczne wstrzykiwanie elementów przy zwykłym odtwarzaniu.
- **Wirtualizacja tabeli utworów i kolejki (60 FPS Virtualization)**:
  - Pełna wirtualizacja widoku tabeli biblioteki (`sortedTracks`) i kolejki odtwarzania (`queue`) z dynamicznym wyliczaniem widocznego okna i buforami pozycji.
  - Błyskawiczny czas reakcji interfejsu i płynne przewijanie przy dowolnie wielkich kolekcjach muzycznych.
- **Synchronizacja metadanych MPRIS i Discord RPC**:
  - Automatyczny hook synchronizujący metadane i okładkę w locie przy każdej zmianie utworu w aplikacji.
  - Metoda `current_queue_item()` w silniku audio jako niezawodny fallback metadanych dla zewnętrznych klientów D-Bus / MPRIS (w tym VesktopRPCBridge).
- **Eksport pętli A-B oraz normalizacja ścieżek `file://`**:
  - Obsługa znaczników pętli A-B w oknie eksportu DSP z automatycznym docięciem zakresu czasu oraz bezpieczną normalizacją URI.

### Dodano (Added)
- **Widok szczegółowy albumu (Album Detail View / Drill-down)**:
  - Kliknięcie w kartę albumu otwiera bogaty, szklany widok szczegółowy albumu z dużą grafiką okładki, pełnymi metadanymi, rokiem wydania, łączną liczbą utworów, łącznym czasem trwania oraz badge'ami jakości Hi-Res i formatów.
  - Pełna tabela utworów albumu uporządkowana według numerów płyt (`disc_no`) i ścieżek (`track_no`) z możliwością bezpośredniego odtworzenia dowolnego pojedynczego utworu (bez nadpisywania kolejki odtwarzania), dodania pojedynczego utworu do kolejki (`+`), polubienia, edycji tagów i otwarcia folderu.
  - Przyciski szybkiej akcji w nagłówku albumu: „Odtwórz od początku”, „Dodaj cały album do kolejki”, „Dopasuj okładkę online” oraz „Otwórz folder”.
  - Przycisk powrotu `← Wróć do wszystkich albumów` oraz licznik utworów na każdej karcie albumu w siatce.
- **Transliteracja Romaji japońskich tekstów piosenek (Hepburn Romanization)**:
  - Silnik transliteracji w `apps/desktop/src/utils/romaji.ts` obsługujący Hiraganę, Katakanę, digrafy Youon (きゃ, きゅ, きょ itp.), podwajanie spółgłosek Sokuon (っ / ッ, w tym wariant `tch`), przedłużenia samogłosek Choonpu (ー) oraz japońską interpunkcję.
  - Przełącznik trybu w widoku tekstów `LyricsView.tsx`: `Kana (Oryginał)` / `Romaji` / `Dwuwiersz Karaoke (Kana + Romaji)`.
  - W trybie dwuwiersza tekst japoński jest prezentowany z neonową, stylizowaną kursywą Romaji tuż poniżej aktywnego wersu, wzorowaną na ekranach japońskich systemów karaoke JOYSOUND i DAM.
- **Pływający pasek tekstu na pulpicie (Desktop Lyrics Overlay / HUD)**:
  - Przesuwalny (Drag & Drop), półprzezroczysty widżet karaoke `DesktopLyricsOverlay.tsx` unoszący się ponad wszystkimi oknami i widokami aplikacji.
  - Wyświetlanie aktywnej linijki tekstu z neonowym gradientem karaoke, podglądem nadchodzącego wersu, paskiem postępu i kontrolkami odtwarzania (Play/Pause, Prev, Next).
  - Wbudowany przełącznik Romaji, regulacja rozmiaru czcionki (Small / Medium / Large), 3 poziomy przezroczystości tła (Translucent 45% / Glass 78% / Solid 94%), blokada pozycji (Lock) i tryb zwinięty (Compact strip).
- **Tryb Wirującego Winylu i Retro Kasety Magnetofonowej w BigScreenView**:
  - Przełącznik trybów wizualizacji: `Okładka` / `Płyta Winylowa` / `Retro Kaseta`.
  - **Tryb Winylu (Vinyl LP)**: realistyczna czarna płyta z mikro-rowkami, stożkowymi odbłyskami światła, centralną naklejką albumu oraz metalicznym ramieniem gramofonu (Tonearm), które płynnie przesuwa igłę od zewnętrznej krawędzi ku środkowi wraz z postępem odtwarzania. Prędkość obrotu płyty jest sprzężona z suwakiem tempa DSP.
  - **Tryb Retro Kasety (Cassette Tape)**: japońska kaseta magnetofonowa Hi-Fi z lat 90. z przezroczystym okienkiem, kręcącymi się szpulami w tempie muzyki, realistyczną taśmą magnetyczną, której grubość na lewej i prawej szpuli zmienia się w czasie rzeczywistym z postępem utworu, oraz papierową etykietą z tytułem i wykonawcą.
- **Wsparcie Crossfeed dla słuchawek (Bauer stereophonic-to-binaural / bs2b)**:
  - Element GStreamera `bs2b` z bezstratnym bypass (`set_passthrough`) w domenie próbek `F32LE`.
  - Wbudowane presety akustyczne: Domyślny wirtualnych głośników (30°, 3m — 700 Hz / 4.5 dB), Chu Moy (700 Hz / 6.0 dB), Jan Meier Corda (650 Hz / 9.0 dB) oraz tryb użytkowniczki z suwakami częstotliwości i poziomu sprzężenia.
  - Szklana karta w Ustawieniach z błękitnym neonem i natychmiastowym przełączaniem w locie.
- **Automatyczne pomijanie ciszy (Silence Trimming / Auto-skip)**:
  - Filtr GStreamera `cutter` (`leaky=true`) z dedykowanymi konwerterami `audioconvert` dropujący bufory ciszy poniżej konfigurowalnego progu (-80 dBFS .. -25 dBFS).
  - Płynne przeskakiwanie ciszy na początku i końcu utworu bez ręcznego przewijania.
- **Inteligentny ReplayGain (Smart Track/Album Gain)**:
  - Nowy tryb `Auto` automatycznie wybierający Album Gain dla sekwencyjnego odtwarzania utworów z tego samego albumu lub Track Gain dla playlist mieszanych i trybu losowego (Shuffle).
  - Dodatkowy suwak `Fallback Gain` (dla utworów bez tagów ReplayGain) oraz przełącznik limitera True-Peak (`rglimiter`) chroniącego przed obcinaniem sygnału.
- **Oficjalne scrobblowanie do Last.fm (Last.fm 2.0 API)**:
  - Moduł `lastfm.rs` w `crates/metadata` z autoryzacją Web Authentication (token + session key), wyliczaniem sygnatur MD5 zgodnie ze specyfikacją Last.fm API.
  - Automatyczne powiadomienia „Teraz odtwarzane” (Now Playing) po uruchomieniu utworu oraz scrobblowanie po odsłuchaniu co najmniej 50% czasu trwania utworu (dla utworów >= 30s).
  - Szklana karta w Ustawieniach z markowym czerwonym akcentem Last.fm, bezpiecznym logowaniem przez przeglądarkę, weryfikacją sesji oraz opcją własnego API Key / Secret.
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
