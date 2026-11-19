# CHANGELOG_PENDING.md — Rejestr zmian roboczych (Changelog Staging)

> **INSTRUKCJA DLA AGENTA I DEWELOPERÓW:**
> 1. Za każdym razem, gdy wprowadzasz nową funkcję, poprawkę błędu lub refaktor, **musisz dopisać podsumowanie zmiany w odpowiedniej sekcji poniżej**.
> 2. Nie czekaj do momentu wydania — rejestruj zmiany na bieżąco zwięzłym, przejrzystym opisem w języku polskim.
> 3. Podczas przygotowywania nowego wydania (np. bumpu wersji do kolejnego numeru):
>    - Wszystkie zebrane poniżej punkty są weryfikowane i przenoszone do pliku [`CHANGELOG.md`](./CHANGELOG.md) pod nowym nagłówkiem wersji `## [X.Y.Z] — „Kryptonim” - YYYY-MM-DD`.
>    - Poniższe sekcje są czyszczone do stanu początkowego na kolejny cykl deweloperski.
>    - Nowa wersja jest również dodawana do pliku danych [`apps/desktop/src/data/changelog.json`](./apps/desktop/src/data/changelog.json) (nie modyfikuj bezpośrednio kodu [`ChangelogView.tsx`](./apps/desktop/src/views/changelog/ChangelogView.tsx)).

---

## Oczekujące zmiany na kolejne wydanie (Unreleased / Next Release)

### ✨ Dodano (Added)
- **Interaktywne przeciąganie animowanej fali dźwiękowej (Drag-to-Seek na falogramie `WaveformCanvas`)**:
  - Wprowadzono płynne, bezpośrednie przeciąganie wskaźnika odtwarzania myszą oraz dotykiem na animowanym przebiegu fali we wszystkich 4 stylach wizualnych: Gładka Fala (`smooth`), Słupki Cyber (`bars`), Przewijana Fala DJ (`scrolling`) oraz Lustrzane Spektrum (`mirror`).
  - Zastosowano mechanizm Pointer Events z przechwytywaniem wskaźnika (`setPointerCapture`) oraz asekuracyjnym śledzeniem zdarzeń na poziomie okna przeglądarki (`window`), eliminując gubienie gestu przy szybkim wyjechaniu poza kontener.
  - Podczas przeciągania na żywo odświeżana jest podświetlona część utworu, igła DJ-a oraz pływający wskaźnik czasu (stabilne 60/120 FPS), a właściwy skok odtwarzania (`seek_with_fade`) następuje dopiero w momencie zwolnienia przycisku myszy (`onPointerUp` / `handleSeekCommit`).
  - Dodano pełne pokrycie testami jednostkowymi w nowym pliku `WaveformCanvas.test.tsx`.
- **Nowoczesna struktura danych i paginacja widoku historii wydań (`ChangelogView`)**:
  - Wyodrębniono całą bazę 38 wydań z monolitycznego pliku komponentu do ustrukturyzowanego pliku danych [`apps/desktop/src/data/changelog.json`](./apps/desktop/src/data/changelog.json).
  - Wdrożono wygodną paginację z wyborem liczby wydań na stronę (3, 5 lub 10 wydań), skrótami do pierwszej i ostatniej strony, nawigacją poprzednia/następna oraz inteligentnym wielokropkiem (`...`) przy dużej liczbie stron.
  - Dodano automatyczne, łagodne przewijanie do góry widoku po zmianie strony oraz dedykowany zestaw testów jednostkowych `ChangelogView.test.tsx`.
- **Dwuetapowe przewijanie utworów i płynny podgląd (Two-Phase Seeking)**:
  - Wprowadzono natychmiastową reakcję suwaków pozycji (60/120 FPS) podczas przeciągania myszą lub dotykiem, bez zacinania dźwięku i bez wysyłania zbędnych zapytań IPC w trakcie ruchu (`handleSeekPreview`).
  - Właściwy skok odtwarzania następuje dopiero po zwolnieniu suwaka (`onPointerUp`, `onMouseUp`, `onTouchEnd`, `onKeyUp`) za pośrednictwem funkcji `handleSeekCommit`.
- **Podwójny tryb regulacji głośności (Instant Zero-Latency & Smooth S-Curve Fade)**:
  - Przeniesiono element `volume` w potoku GStreamera za bufor wyjściowy `queue_sink` (`queue_sink -> volume -> sink`), co całkowicie wyeliminowało 600-milisekundowe opóźnienie bufora wyjściowego i pozwoliło na reakcję karty dźwiękowej poniżej 15 ms.
  - Wdrożono wybór trybu głośności w ustawieniach (`instantVolume`):
    - **Tryb natychmiastowy (Instant Response)**: bezpośrednie wysyłanie polecenia IPC (0 ms opóźnienia) z płynnym scalaniem ruchów suwaka zsynchronizowanym z odświeżaniem ekranu (`requestAnimationFrame`).
    - **Tryb płynnego przejścia (Smooth Fade)**: studyjna, miękka interpolacja krzywą cosinusową S-curve po stronie silnika audio w Rust (`set_volume_smooth`, 60–120 ms w krokach co 8 ms) z natychmiastowym przerwaniem poprzedniej generacji oraz płynną animacją suwaka w UI, eliminująca trzaski cyfrowe i szum schodkowy.
    - **Wyciszanie i odciszanie (Mute/Unmute)**: w trybie płynnym łagodne wygaszenie i przywrócenie dźwięku w 120 ms; w trybie natychmiastowym natychmiastowe odcięcie lub przywrócenie poziomu.
- **Niezależne, w pełni asynchroniczne operacje w tle (brak zacinania interfejsu)**:
  - Wszystkie komendy backendu korzystające z bazy danych SQLite i sieci (zarządzanie biblioteką, zakładki, motywy, playlisty, presety DSP, statystyki, skanowanie ReplayGain i okładki) działają teraz w pełni asynchronicznie w puli wątków Tokio, dzięki czemu interfejs odtwarzacza zachowuje pełną responsywność.
- **Szybsze uruchamianie programu dzięki ładowaniu okien na żądanie (`React.lazy`)**:
  - Wprowadzono podział kodu (`React.lazy` oraz `Suspense`) dla 32 modali narzędziowych i analitycznych w `AppModalsContainer.tsx` (m.in. korektory, edytor tagów, mikser stemów, analizator muzyczny, asystent ReplayGain).
  - Zmniejszono główną paczkę startową JavaScript o około 380 kB (~20% mniejszy rozmiar kodu pobieranego przy uruchomieniu).
- **Nowy instalator Linuksa z osobnym kanałem deweloperskim (`install.sh`)**:
  - Dodano możliwość instalacji wersji deweloperskiej (`auralune-dev`) równolegle ze stabilną (`auralune`), z całkowicie odizolowanymi plikami wykonywalnymi, profilami i skrótami systemowymi.
  - Wbudowano automatyczną detekcję wtyczek multimedialnych GStreamera w systemie użytkownika, zapobiegając brakowi dźwięku na dystrybucjach typu Arch Linux.
- **Automatyczne budowanie wersji testowych w GitHub Actions (`ci.yml`)**:
  - Każda zmiana wprowadzana do gałęzi deweloperskiej automatycznie tworzy i publikuje świeżą paczkę AppImage z oznaczeniem `dev`, gotową do pobrania i aktualizacji przez instalator.
- **Uniwersalny skrypt weryfikacji całego projektu (`tests/run_all_tests.sh`)**:
  - Przygotowano 7-stopniowy zestaw sprawdzający: formatowanie kodu Rusta (`cargo fmt`), linter oxlint i testy jednostkowe Vitest, poprawność typów TypeScript i build Vite, linter Rust Clippy (`-D warnings`), testy jednostkowe i integracyjne backendu Rust, test dymny `desktop_smoke_test` oraz poprawność składni skryptów powłoki (`bash -n`).
  - Dodano poręczne przełączniki: `--fix` (automatyczne formatowanie), `--fast` (szybkie testy bez ciężkich prób audio) oraz `--bundle` (lokalny test paczkowania AppImage).
- **Nowe dokumenty architektoniczne dla deweloperów i agentów AI**:
  - Utworzono całościowy podręcznik architektury [`AGENTS.md`](./AGENTS.md) opisujący strukturę modułów, bazy danych SQLite, komend Tauri, hooków domenowych i protokołów weryfikacji.
  - Utworzono plik [`DEVELOPMENT.md`](./DEVELOPMENT.md) z opisem konfiguracji środowiska, komend testowych i procesu budowania wydań.
- **Duże rozszerzenie testów automatycznych**:
  - **Pamięć i baza danych**: dodano testy CRUD biblioteki, zakładek i punktów cue, ustawień, presetów DSP, transkrypcji i profili fali dźwiękowej, projektów wielościeżkowych stemów, statystyk, podsumowań Recap oraz trwałości kolejki.
  - **Silnik audio i DSP**: przetestowano granice procesora DSP, współbieżność, edytor metadanych (w tym polskie znaki diakrytyczne i odporność na uszkodzone pliki), stabilność odtwarzania przy skrajnych poziomach głośności oraz gwałtownym przewijaniu.
  - **Parsery i integracja z systemem**: dodano testy arkuszy CUE (z przerwami pregap), playlist M3U/M3U8, modułu Waybar oraz komend sterowania IPC.
  - **Interfejs użytkownika**: przetestowano wyłącznik czasowy (Sleep Timer z łagodnym wyciszaniem), formatowanie czasu, normalizację tekstu, router widoków, dok odtwarzacza oraz interaktywny falogram `WaveformCanvas`.

---

### 🛠️ Poprawiono (Fixed)
- **Dwukierunkowe sortowanie i wskaźniki kierunku dla domyślnej kolejności utworów (`#`) w bibliotece**:
  - Rozwiązano problem braku reakcji na ponowne kliknięcie nagłówka kolumny `#` (`default`) oraz braku możliwości odwrócenia domyślnej kolejności utworów.
  - W hooku `useLibraryManager.ts` obsłużono kierunek sortowania (`sortOrder === 'asc' ? baseList : [...baseList].reverse()`) w gałęzi `sortField === 'default'`, dzięki czemu ponowne kliknięcie nagłówka `#` lub użycie przycisku zmiany kierunku na pasku narzędzi natychmiast odwraca listę utworów (z zachowaniem aktywnych filtrów inteligentnych playlist).
  - W nagłówku kolumny `#` w `LibraryView.tsx` zastąpiono statyczną kropkę aktywnym wskaźnikiem kierunku (`▲` dla rosnącego, `▼` dla malejącego), włączono widoczność przycisku przełączania kierunku w toolbarze przy wybranym domyślnym sortowaniu oraz zaktualizowano pasek stanu i akcję odtwarzania posortowanej kolejki.
  - Dodano dedykowane testy jednostkowe weryfikujące przełączanie kierunku sortowania domyślnego w `useLibraryManager.test.ts`.
- **Kompleksowe oczyszczenie adnotacji lintera React 19 i ESLint/Oxlint w CI/CD**:
  - Wyeliminowano ostrzeżenia `react(refs)` oraz `react(purity)` w `usePlaybackController.ts` poprzez przeniesienie synchronizacji referencji do hooków `useEffect` oraz wyeliminowanie nieczystych wywołań czasu (`Date.now()`, `performance.now()`) w trakcie fazy renderowania komponentów (`TrackStatsModal.tsx`, `VinylTurntable.tsx`).
  - Zastosowano bezpieczny wzorzec `pollingDepsRef` w pętli odpytywania stanu backendu, usuwając ostrzeżenie `react-hooks(exhaustive-deps)` i gwarantując przekazywanie najświeższych tokenów i danych bez efektu przestarzałych domknięć (stale closures) w scrobblerach Last.fm i ListenBrainz.
  - Poprawiono tablice zależności w hookach `useCallback` i `useEffect` w `useTranscodeManager.ts`, `KeyBpmModal.tsx`, `HarmonicSuggesterModal.tsx` oraz `BigScreenView.tsx`.
  - Zastąpiono nieużywane parametry błędów `catch (_)` nowoczesną składnią `catch {}` w `useAmbienceMode.ts`, `usePlaybackController.ts`, `useAudioSettings.ts`, `VuMeterWidget.tsx` oraz `SpectrumVisualizer.tsx`.
- **Poprawka uprawnień buforowania pakietów APT w potoku CI (GitHub Actions)**:
  - Rozwiązano problem niepowodzenia zapisu pamięci podręcznej (`/usr/bin/tar failed with error: exit code 2: Permission denied`) w kroku `Post job cleanup` dla ścieżki `/var/cache/apt/archives`.
  - Wprowadzono automatyczne usuwanie systemowych plików blokad roota (`lock` oraz katalogu `partial`) oraz nadawanie uprawnień odczytu dla użytkownika `runner` zaraz po instalacji pakietów, co zapewnia w 100% bezbłędne tworzenie archiwum `.tzst` w akcji `actions/cache`.
- **Czysty tryb Bit-Perfect (True Passthrough Bypass) dla korektora graficznego i parametrycznego**:
  - Wprowadzono automatyczne włączanie natywnego trybu passthrough (`transform.set_passthrough(true)`) na elementach GStreamera `equalizer-10bands` oraz `equalizer-nbands`, gdy korektory są wyłączone lub nie posiadają aktywnych pasm. Zapobiega to zbędnemu przetwarzaniu próbek przez filtry IIR przy wyłączonym EQ, gwarantując 100% bit-exact bypass bez podbarwień i przesunięć fazowych.
  - Naprawiono warunek wyświetlania stanu przycisku EQ w `DspStudioView.tsx`, usuwając błąd fałszywego wskazywania włączonego korektora przy wartości `undefined`.
- **Podział paczek (Code-Splitting) w Vite i redukcja rozmiaru początkowego**:
  - Skonfigurowano precyzyjny podział kodu (`manualChunks`) w pliku `apps/desktop/vite.config.ts`, wyodrębniając biblioteki dostawców (`react-vendor`, `icons-vendor`, `tauri-vendor`), bazę historii wydań (`changelog-data`), słowniki lokalizacyjne (`locales-data`) oraz duże widoki (`view-dsp`, `view-library`, `view-settings`).
  - Zredukowano główny plik startowy JavaScript z ponad 1,57 MB do zaledwie 465 kB (110 kB po kompresji gzip), całkowicie usuwając ostrzeżenia minifikacji bundlera o przekroczeniu limitu 500 kB na paczkę i przyspieszając ładowanie interfejsu.
- **Poprawka celów paczkowania w `tauri.conf.json` i zgodność wersji deweloperskiej**:
  - Skonfigurowano jawne cele paczkowania na Linuksie jako `["appimage", "deb"]` zamiast domyślnego `"all"`, co wyeliminowało błąd bundlera RPM (`invalid version "1.1.6-dev": contains invalid character '-'`) pojawiający się na dystrybucjach z zainstalowanym narzędziem `rpmbuild` (np. Arch Linux / CachyOS, Fedora).
- **Przywrócenie działania zakładki statystyk i podsumowań (Recap & Stats Dashboard)**:
  - Naprawiono błąd trasowania w routerze głównej zawartości (`MainContentRouter.tsx`), przywracając brakującą gałąź dla aktywnej zakładki `'stats'` i podłączając komponent `StatsDashboardView.tsx`.
  - Przekazano właściwości statystyk (`statsProps`) w hookach nawigacyjnych (`useMainRouterProps.ts` oraz `useMainContentRouterProps.ts`).
  - W nagłówku panelu statystyk umieszczono przycisk bezpośredniego wywołania modalu rocznego podsumowania Recap.
  - Pokryto działanie routera i hooków nawigacyjnych dedykowanymi testami jednostkowymi.
- **Całościowy audyt i 100% lokalizacji interfejsu (i18n)**:
  - Przeprowadzono całościowy audyt kodu frontendu (`apps/desktop`), usuwając wszelkie twardo zakodowane napisy i zastępując je dynamicznymi tłumaczeniami w 5 językach (angielski, polski, niemiecki, fiński, łacina).
  - Przetłumaczono etykiety, opisy, dymki podpowiedzi (tooltips) i powiadomienia toast m.in. w:
    - Inspektorze toru audio (`AudioPathInspectorModal`): formaty, częstotliwości próbkowania, głębia bitowa, kanały stereo, parametry tempo/pitch, latencja DSP, bufor odtwarzacza, stany bit-perfect i direct bypass;
    - Centrum pobierania audio (`DownloadHubModal`): zlokalizowane placeholdery nazw plików oraz sum kontrolnych SHA-256;
    - Szpuli magnetofonowej i gramofonie (`TapeDeckWidget`, `VinylTurntable`): tytuły nagłówka ("STUDIO TAPE DECK"), prędkości, typy taśm i ramiona gramofonowe;
    - Panelu kolejki i nagłówku aplikacji (`QueueDrawer`, `AppHeader`, `BottomPlaybackDock`): przyciski Auto-DJ, Recap, Harmonic DJ oraz tryby odtwarzania losowego i pętli;
    - Widokach biblioteki, playlist i radia (`LibraryView`, `PlaylistsView`, `RadioView`): nagłówki kolumn formatu, przycisk powrotu do albumów oraz zlokalizowane opisy stacji radiowych;
    - Generatorze dźwięków tła (`SoundscapeModal` i `soundscapeAudio.ts`): wielojęzyczne nazwy wszystkich gotowych presetów relaksacyjnych;
    - Oknie miksera stemów (`StemProjectStudioModal`): komunikaty o błędach, powiadomienia o tworzeniu i eksporcie archiwum ZIP, licznik ścieżek instrumentów oraz status separacji na żywo;
    - Studiu DSP (`DspStudioView`): etykiety szerokości sceny stereo, podpowiedź studia dynamiki i lampy oraz jednostki półtonów.
  - Naprawiono błąd gubienia wybranego języka w kontenerze modali (`AppModalsContainer.tsx`) – wyeliminowano sytuację, w której domyślny język polski był wymuszany w oknach dialogowych niezależnie od wybranego języka w ustawieniach.
  - Zapewniono 100% zgodności i symetrii kluczy we wszystkich 5 plikach lokalizacyjnych (`src/locales/{en,pl,de,fi,la}.json`), zweryfikowane automatycznym testem jednostkowym `i18n.test.ts`.
- **Poprawki ostrzeżeń lintera React 19 i zgodności z hookami**:
  - Usunięto synchroniczne wywołania `setState` wewnątrz efektów `useEffect` (zapobiegając kaskadowym przerysowaniom) m.in. w `UrlAudioImportModal`, `DesktopLyricsOverlay`, `LyricsView`, `TrackBookmarksModal`, `StemProjectStudioModal` oraz `VolumeOsd`.
  - Usunięto nieczyste wywołania funkcji w trakcie renderowania w `TapeDeckWidget`.
  - Uzupełniono brakujące zależności w hookach `useEffect` i `useCallback` w `DesktopLyricsOverlay`, `LyricsView` i `StemProjectStudioModal`.
- **Skrócenie czasu instalacji zależności systemowych w potoku CI z 12 minut do 1-2 minut**:
  - Zoptymalizowano krok instalacji bibliotek GStreamera, PipeWire, WebKitGTK i AppIndicator w GitHub Actions poprzez buforowanie pakietów apt (`actions/cache`) oraz zastosowanie flagi `--no-install-recommends`.
- **Rozwiązanie problemu kolizji tagu deweloperskiego w GitHub Actions**:
  - Naprawiono błąd `dst refspec dev matches more than one` przy automatycznym wypychaniu wydań AppImage, stosując precyzyjny refspec `refs/tags/dev:refs/tags/dev`.
- **Płynne wyciszanie przy przewijaniu (Smooth Seek Fade)**:
  - Naprawiono błąd, przez który puszczenie suwaka pozycji ignorowało włączoną opcję łagodnego wyciszania.
  - Opcja działa teraz spójnie we wszystkich widokach aplikacji: głównym pasku doku, widoku odtwarzacza, trybie pełnoekranowym, Mini Playerze, nakładce tekstu piosenki, widoku fali dźwiękowej oraz osi akordów.
  - Zastosowano delikatne, studyjne mikro-wygaszenie (20–48 ms), które skutecznie usuwa wszelkie trzaski i stuki w głośnikach lub słuchawkach podczas skoków w utworze.
- **Koniec z cofaniem i szarpaniem suwaków (rubberbanding)**:
  - Zabezpieczono suwaki czasu i głośności za pomocą flag interakcji (`isSeekingRef`, `isVolumeInteractingRef`), dzięki czemu asynchroniczne odpytywanie stanu z backendu nie nadpisuje pozycji w trakcie trwania gestu użytkownika.
- **Płynna regulacja głośności bez zatykania komunikacji**:
  - Zastosowano łagodne dławienie częstych zdarzeń przeciągania suwaka głośności, zachowując jednocześnie natychmiastową reakcję dla przycisku wyciszenia/odciszenia.
- **Szybsza i stabilniejsza baza danych SQLite**:
  - Wprowadzono bezpieczny mechanizm aktualizacji bazy danych w oparciu o wersję schematu (`PRAGMA user_version`), usuwając błędy o powielonych kolumnach przy starcie programu.
  - Zwiększono pamięć podręczną SQLite (do 64 MB) i włączono szybki tryb zapisu w pamięci RAM oraz mapowanie pamięci (`mmap`), co zauważalnie przyspiesza działanie aplikacji na dużych bibliotekach.
- **Zmniejszone zużycie procesora i baterii przez wizualizator**:
  - Animacja analizatora widma (`SpectrumVisualizer.tsx`) i efektów anime automatycznie zatrzymuje się, gdy okno programu jest zminimalizowane lub ukryte w tle (`document.hidden`), redukując zużycie GPU i CPU do zera.
- **Poprawki w procesie budowania paczek AppImage**:
  - Dodano brakujące pakiety systemowe do potoku CI na GitHubie, co rozwiązało problem z wykrywaniem bibliotek wskaźników zasobnika systemowego.
- **Bezpieczeństwo pobierania instalatora**:
  - Zabezpieczono instalator uruchamiany z gałęzi stabilnej przed przypadkowym pobraniem wersji testowych.
  - Naprawiono obsługę kanału deweloperskiego, aby w razie opóźnienia wydań na GitHubie nie pobierał po cichu przestarzałych wersji stabilnych.

---

### 🔄 Zmieniono (Changed)
- **Kompleksowa dekompozycja monolitycznego pliku `App.tsx`**:
  - Skrócono monolityczny plik `App.tsx` z ponad 3700 linii do zwięzłej, czytelnej powłoki aplikacji (około 1300 linii).
  - Całą logikę biznesową wyodrębniono do ponad 20 dedykowanych hooków domenowych (`useAudioPlayer`, `usePlaybackController`, `usePlaybackQueue`, `useLibraryManager`, `useDspManager`, `useThemeEngine`, `useModalManager`, `useAudioSettings`, `usePlaylistManager`, `useTranscodeManager`, `useMusicBrainzManager`, `useScrobblerManager`, itp.).
  - Główne ekrany aplikacji podzielono na modularne widoki w katalogu `views/` (`views/player/PlayerView.tsx`, `views/library/LibraryView.tsx`, `views/dsp/DspStudioView.tsx`, `views/playlists/PlaylistsView.tsx`, `views/stats/StatsDashboardView.tsx`, `views/changelog/ChangelogView.tsx`, `views/settings/AppSettingsModal.tsx`).
  - Wprowadzono architekturę hooków budujących zestawy właściwości (`useMainRouterProps`, `useMainContentRouterProps`, `useAppHeaderProps`, `useBottomPlaybackDockProps`, `useAppModalsProps`, `useAppSettingsModalProps`).
- **Wydzielenie słowników tłumaczeń do plików JSON**:
  - Przeniesiono gigantyczny plik `i18n.ts` (ponad 4800 linii) do czytelnych plików JSON w folderze `src/locales/` (`en.json`, `pl.json`, `de.json`, `fi.json`, `la.json`), a moduł `i18n.ts` przekształcono w zwięzły mechanizm ładujący z pełną kontrolą typów.
- **Porządki i modularna architektura aplikacji desktopowej (`apps/desktop/src-tauri`)**:
  - Skrócono monolityczny plik `lib.rs` z 4914 linii do zaledwie 336 linii.
  - Wszystkie 162 komendy aplikacji przeniesiono do czytelnych, tematycznych plików w katalogu `commands/` (m.in. odtwarzanie, biblioteka, korektor graficzny, motywy, zakładki, urządzenia, stemmy, presety, transkodowanie).
  - Logikę startową i menu zasobnika systemowego wyodrębniono do osobnego modułu `setup/`.
- **Uporządkowanie modułu pamięci podręcznej i bazy danych (`crates/storage`)**:
  - Podzielono duży plik `lib.rs` (ponad 3000 linii) na 9 mniejszych, wyspecjalizowanych podmodułów w `src/` (`models`, `schema`, `library`, `bookmarks`, `settings`, `playlists`, `stats`, `analysis`, `stems`).
  - Fasada `crates/storage/src/lib.rs` została zredukowana do zaledwie 74 linii.
- **Kompleksowe wydzielenie testów ze źródeł produkcyjnych do osobnych plików (`tests/`)**:
  - Usunięto wewnętrzne bloki testowe (`#[cfg(test)]`) z produkcyjnych plików źródłowych we wszystkich modułach Rusta (`storage`, `domain`, `metadata`, `downloads`, `dsp-api`, `desktop-integration`, `audio-engine` oraz `src-tauri`).
  - Wszystkie testy przeniesiono do przejrzystych plików w dedykowanych folderach `tests/` lub wydzielonych modułach testowych, co przyspiesza kompilację równoległą i ułatwia przegląd kodu produkcyjnego.
- **Błyskawiczne wyszukiwanie i sortowanie w bibliotece**:
  - Zastosowano odroczoną aktualizację wyników (`useDeferredValue`), dzięki czemu wpisywanie tekstu w polu wyszukiwania nie zacina interfejsu (stabilne 120 FPS nawet w bardzo dużych kolekcjach).
  - Przyspieszono sortowanie utworów, albumów i artystów (2–3x szybsze działanie dzięki `Intl.Collator`) z pełnym uwzględnieniem polskich reguł językowych.
- **Mniejsze obciążenie komputera w spoczynku**:
  - Odtwarzacz sprawdza stan co 100 ms podczas odtwarzania muzyki, a w stanie pauzy lub zatrzymania co 350 ms, zmniejszając niepotrzebne zużycie procesora.
- **Lepsza płynność interfejsu dzięki memoizacji komponentów**:
  - Kluczowe komponenty ekranu (`BottomPlaybackDock`, `PlayerView`, `LibraryView`) zostały zoptymalizowane za pomocą `React.memo`, eliminując zbędne przerysowywanie całego okna przy każdym tyknięciu licznika czasu.
- **Aktualizacja narzędzi deweloperskich**:
  - Zaktualizowano środowisko do Node.js 22 LTS, menedżera pnpm 10 oraz najnowszej stabilnej wersji kompilatora Rust (edycja 2024).
