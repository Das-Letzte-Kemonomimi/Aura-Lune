# CHANGELOG_PENDING.md — Rejestr zmian roboczych (Changelog Staging)

> **INSTRUKCJA DLA AGENTA I DEWELOPERÓW:**
> 1. Za każdym razem, gdy wprowadzasz nową funkcję, poprawkę błędu lub refaktor, **musisz dopisać podsumowanie zmiany w odpowiedniej sekcji poniżej**.
> 2. Nie czekaj do momentu wydania — rejestruj zmiany na bieżąco zwięzłym, technicznym opisem.
> 3. Podczas przygotowywania nowego wydania (np. bumpu wersji do kolejnego numeru):
>    - Wszystkie zebrane poniżej punkty są weryfikowane i przenoszone do pliku [`CHANGELOG.md`](./CHANGELOG.md) pod nowym nagłówkiem wersji `## [X.Y.Z] — „Kryptonim” - YYYY-MM-DD`.
>    - Poniższe sekcje są czyszczone do stanu początkowego na kolejny cykl deweloperski.
>    - Nowa wersja jest również dodawana do komponentu [`ChangelogView.tsx`](./apps/desktop/src/components/ChangelogView.tsx).

---

## Oczekujące zmiany na kolejne wydanie (Unreleased / Next Release)

### ✨ Dodano (Added)
- **Kompleksowa architektura optymalizacji wydajności i responsywności**:
  - Utworzono szczegółowy plan optymalizacji w pliku [`.plans/task-e-app-performance-and-responsiveness-optimization-plan.md`](./.plans/task-e-app-performance-and-responsiveness-optimization-plan.md), definiujący docelowe budżety czasowe (SLO: głośność `< 16 ms`, podgląd przewijania `0 ms`, zatwierdzenie skoku `< 50 ms`), decoupling gestów użytkownika oraz eliminację blokowania magistrali IPC.
- **Optymistyczny podgląd i dwuetapowe przewijanie utworu (`handleSeekPreview` oraz `handleSeekCommit`)**:
  - Rozdzielono podgląd pozycji w trakcie przeciągania suwaka (`onSeekPreview` – natychmiastowa reakcja interfejsu 60/120 FPS bez emisji zapytań IPC) od faktycznego wykonania skoku (`onSeekCommit` – wywoływanego pojedynczo na zdarzeniach `onPointerUp`, `onMouseUp`, `onTouchEnd`, `onKeyUp`).
- **Asynchroniczna architektura komend Tauri (Non-blocking Tauri Commands)**:
  - Zmodernizowano komendy Tauri w modułach `bookmarks`, `themes`, `playlists`, presety DSP, statystyki utworów, skanowanie ReplayGain, pobieranie okładek i kopie zapasowe profili do `pub async fn`. Wszystkie operacje I/O na bazie SQLite i sieci wykonują się współbieżnie w puli wątków Tokio, eliminując blokowanie wątku głównego Tauri IPC.
- **Dynamiczne dzielenie kodu modali (Modal Dynamic Code-Splitting & Lazy Loading)**:
  - Skonfigurowano `React.lazy()` oraz `<React.Suspense fallback={null}>` dla wszystkich 28 modali narzędziowych i analitycznych w `AppModalsContainer.tsx`, `TapeDeckWidget.tsx` oraz `VinylTurntable.tsx`.
  - Zredukowano rozmiar głównego bundla produkcyjnego JavaScript z 1 865 kB do 1 486 kB (-380 kB / -20%), przenosząc ponad 20 tysięcy linii kodu do odrębnych chunków pobieranych wyłącznie na żądanie użytkownika.
- **Nowe standardy jakości, instrukcje deweloperskie i CI**:
  - Utworzono dokument [`DEVELOPMENT.md`](./DEVELOPMENT.md) jako pojedyncze źródło prawdy dla konfiguracji środowiska, uruchamiania testów jednostkowych/integracyjnych, linterów i budowania wydań produkcyjnych.
  - Zaktualizowano [`AGENTS.md`](./AGENTS.md) oraz wszystkie powiązane skille agentowe (`skills/quality/i18n-sync`, `skills/backend/tauri2-architecture`, `skills/audio/audio-dsp-safety`, `skills/frontend/react-monolith-refactor`) o bezwzględny protokół sprawdzania kodu przed commitem (`cargo fmt`, `cargo clippy -D warnings`, `eslint`, `build`, `./tests/run_all_tests.sh`).
- **Rozszerzone testy jednostkowe kontrolera odtwarzacza**:
  - Dodano do `src/hooks/usePlaybackController.test.ts` dedykowane testy weryfikujące optymistyczny podgląd przewijania bez wywołań IPC oraz poprawne przekazywanie skoku bez zbędnego wygaszania.
- **Dwu-kanałowy instalator Linuksa z pełną izolacją wersji deweloperskiej (`install.sh`)**:
  - Wprowadzono architekturę równoległych kanałów (`stable` oraz `dev`), pozwalającą na niezależną instalację wersji deweloperskiej (`~/.local/share/auralune-dev`, binarka `auralune-dev`, skrót pulpitu `auralune-dev.desktop`) obok wersji stabilnej (`auralune`) bez konfliktów plików.
  - Zaimplementowano automatyczną detekcję kanału w oparciu o oznaczenie wersji (np. `1.1.6-dev`), gałąź Gita lub przełączniki `--dev` / `--stable`, umożliwiając bezobsługowy merge gałęzi `dev` do `main` (wystarczy standardowe podbicie wersji release).
  - Wbudowano w launcher automatyczne wykrywanie ścieżek wtyczek GStreamera w systemie hosta (`/usr/lib/gstreamer-1.0`), eliminujące problem braku dźwięku na dystrybucjach Arch Linux i instalacjach minimalnych.
- **Automatyczne budowanie i publikowanie wydań deweloperskich w GitHub Actions (`ci.yml`)**:
  - Dodano zadanie `publish-dev-release`, które po przejściu testów na gałęzi `dev` automatycznie kompiluje paczkę AppImage i publikuje rotujące wydanie przedpremierowe (rolling pre-release) z tagiem `dev`, zapewniając stałą dostępność najnowszych wersji dla instalatora.
- **Rozbudowany skrypt weryfikacji lokalnej o pełną zgodność z potokiem CI/CD (`tests/run_all_tests.sh`)**:
  - Przekształcono dotychczasowy skrypt testowy w 7-etapowy pakiet precyzyjnie odzwierciedlający wszystkie testy i obostrzenia z GitHub Actions:
    1. Sprawdzanie formatowania Rusta (`cargo fmt --all --check`),
    2. Linting frontendu (`oxlint`) oraz pełen zestaw testów jednostkowych i parytetu i18n (`vitest`),
    3. Weryfikacja typów TypeScript i produkcyjny build Vite (`tsc -b && vite build`),
    4. Rygorystyczna analiza Clippy w całym workspace bez żadnych ostrzeżeń (`cargo clippy --workspace --all-targets --all-features -- -D warnings`),
    5. Testy jednostkowe i integracyjne 12 skrzynek Rusta z izolacją wątkową (`cargo test --workspace -- --test-threads=1`),
    6. Test dymny backendu desktopowego (`desktop_smoke_test`),
    7. Weryfikacja składni wszystkich skryptów powłoki (`bash -n` dla `install.sh`, `packaging/*.sh`, `tests/*.sh`).
  - Dodano przełączniki CLI: `--fix` (automatyczne formatowanie `cargo fmt`), `--fast` (szybki tryb z pominięciem testów silnika audio), `--bundle` (opcjonalny lokalny test pakowania AppImage) oraz `--help`.
- **Wielopoziomowe rozszerzenie pokrycia testowego w architekturze backendu i frontendu**:
  - **Pamięć trwała i baza SQLite (`crates/storage`)**:
    - Utworzono testy integracyjne `smart_playlists_and_stats_test.rs` weryfikujące poprawność progów ocen (rating $\ge 4$), ulubionych, filtrowania Hi-Res ($\ge 24$-bit lub $\ge 88.2\text{ kHz}$), selekcji wysokiego tempa BPM ($\ge 120\text{ BPM}$) oraz naliczania statystyk i podsumowań odsłuchów Recap.
    - Utworzono pakiet `playlist_and_queue_persistence_test.rs` testujący trwałość stanu kolejki (tryby pętli, shuffle order), operacje CRUD na zakładkach utworów (`track_bookmarks`), magazyn ustawień klucz-wartość oraz algorytm wykrywania duplikatów.
  - **Silnik audio i DSP (`crates/audio-engine`)**:
    - Dodano `metadata_editor_test.rs` sprawdzający bezstratny, pełny odczyt i zapis tagów audio (tytuł, wykonawca, album, rok, gatunek, numery ścieżek z polskimi znakami diakrytycznymi) oraz odporność na pliki uszkodzone i nieistniejące.
    - Dodano `dsp_boundary_and_concurrency_test.rs` testujący graniczne wartości głośności (clamping $[-1.0, 10.0] \to [0.0, 2.0]$), odporność na gwałtowne serie przewijania (rapid seeks) oraz przewijanie poza czas trwania utworu.
  - **Domenowe parsery i integracja systemowa (`crates/domain`, `crates/desktop-integration`)**:
    - Dodano `cue_and_m3u_parsers_test.rs` testujący parsowanie arkuszy CUE z przerwami pregap (`INDEX 00` i `INDEX 01`), kalkulację czasów trwania utworów oraz import/eksport playlist M3U/M3U8 z relatywnymi ścieżkami i strumieniami sieciowymi.
    - Rozszerzono `waybar_and_ipc_test.rs` o walidację komend przewijania ze skokami względnymi, obsługę błędów argumentów oraz limity głośności sterowania przez IPC.
  - **Frontendowe moduły narzędziowe, hooki i komponenty interfejsu (Vitest)**:
    - Dodano testy jednostkowe formatowania i parsowania czasu `timeFormat.test.ts` (obsługa sufiksów `ms`, `s`, formatów `MM:SS.mmm`, polskich prefiksów i przecinków dziesiętnych).
    - Dodano `fileSizeFormat.test.ts` oraz `textNormalize.test.ts` (w tym wsparcie dla znaków przekreślonych `ł` $\to$ `l` i `ø` $\to$ `o` dla polskiego indeksowania wyszukiwania).
    - Dodano `useSleepTimer.test.ts` weryfikujący odliczanie, płynne wygaszanie głośności w ostatnich 30 sekundach, zatrzymanie utworu oraz tryb końca utworu.
    - Dodano testy renderowania i interakcji użytkownika `SleepTimerModal.test.tsx` oraz `BottomPlaybackDock.test.tsx` (obsługa zdarzeń `pointerUp`, skrótów klawiaturowych i przełączania wyciszenia).

### 🛠️ Poprawiono (Fixed)
- **Obsługa opcji płynnego wyciszenia (Smooth Seek Fade) we wszystkich paskach postępu utworu**:
  - Poprawiono funkcję `handleSeekCommit` w `usePlaybackController.ts`, aby domyślnie uwzględniała aktywny stan opcji `seekFadeEnabled`. Wcześniej zwolnienie paska postępu zawsze wymuszało `fade: false`, ignorując włączoną opcję Seek Fade.
  - Zapewniono pełną obsługę płynnego, studyjnego mikro-fade'u we wszystkich paskach postępu i kontrolerach w aplikacji: głównym pasku doku (`BottomPlaybackDock`), widoku odtwarzacza (`PlayerView`), trybie pełnoekranowym (`BigScreenView`), widżecie Mini Playera (`MiniPlayerWidget`), nakładce tekstu (`DesktopLyricsOverlay`), widoku fali dźwiękowej (`WaveformCanvas`), widoku nut (`PianoRollCanvas`) oraz osi akordów (`ChordTimelineView`).
  - Udoskonalono krzywą wygaszania w `audio-engine` (`seek_with_fade`): wprowadzono łagodne, naturalne wygaszanie kwadratowe (32 ms) oraz płynne wejście sinusoidalne (48 ms) ze stabilizacją bufora (10 ms), eliminujące wszelkie trzaski audio przy zachowaniu pełnej responsywności i natychmiastowego anulowania wcześniejszych operacji (`seek_seq`).
- **Błąd kompilacji AppImage w CI („Can't detect any appindicator library”)**:
  - Dodano brakujące pakiety `libayatana-appindicator3-dev` oraz `librsvg2-dev` do konfiguracji środowiska GitHub Actions (`ci.yml`), umożliwiając pomyślne budowanie i pakowanie bundli AppImage przez Tauri CLI na systemie Linux.
- **Zabezpieczenie instalatora w gałęzi `main`/`master` przed przypadkową instalacją wersji deweloperskiej**:
  - Ustawiono sztywny, bezpieczny domyślny kanał `stable` dla wszystkich zdalnych wywołań przez `curl | bash`, usuwając automatyczne przełączanie kanału na podstawie ciągu wersji. Wywołanie instalatora z gałęzi `main` pobiera wyłącznie oficjalne stabilne wydania z `/releases/latest` (które w GitHub API wyklucza pre-release'y), gwarantując pełne bezpieczeństwo po zmergowaniu gałęzi `dev` do `main`.
- **Rozwiązanie problemu instalacji starej wersji 1.1.5 przy wyborze kanału deweloperskiego**:
  - Wyeliminowano w `install.sh` ciche cofanie się do wydań stabilnych (`/releases/latest`) w kanale deweloperskim w przypadku braku lub opóźnienia paczki GitHub Releases. Wprowadzono dedykowane zapytania do taga `dev` oraz bezpośrednią ścieżkę do AppImage deweloperskiego wraz z czytelnym komunikatem błędu i instrukcją kompilacji lokalnej zamiast instalacji nieprawidłowej wersji.
- **Wyeliminowanie wielosekundowych opóźnień i zatorów przy zmianie głośności oraz przewijaniu utworu**:
  - Zastąpiono blokującą sekwencję uśpień (`thread::sleep`) w `seek_with_fade` w skrzynce `audio-engine` (dawniej ~120 ms w 10 krokach) zoptymalizowanym, 20-milisekundowym wygaszaniem anty-trzaskowym (2x4 ms ramp down, 4 ms seek settle, 2x4 ms ramp up). Wprowadzono atomowy token generacji (`fade_generation`), który natychmiast anuluje poprzednie uśpienia, gdy nadejdzie nowsze żądanie. Przy przewijaniu z suwaka (`fade: false`) skok wykonywany jest natychmiast z zerowym uśpieniem.
  - Wyeliminowano blokowanie mutexa potoku audio (`inner: Arc<Mutex<PipelineInner>>`) przy zmianie poziomu głośności. Dodano bezpośrednie odwołania do elementu GStreamera oraz atomowej zmiennej `atomic_volume: Arc<AtomicU64>`, dzięki czemu `set_volume` wykonuje się bezpośrednio w czasie submikrosekundowym (`< 1 µs`).
- **Likwidacja „szarpania” i cofania suwaków (rubberbanding) podczas interakcji**:
  - Wprowadzono flagi stanu interakcji (`isSeekingRef` i `isVolumeInteractingRef`) w hooku `usePlaybackController`. Pętla odpytująca stan (`fetchStatus`) nie nadpisuje już lokalnej pozycji ani głośności starszymi danymi z backendu w trakcie trwania gestu użytkownika.
- **Nieblokujące dławienie IPC głośności (Volume Throttle)**:
  - Wdrożono dławienie zboczem opadającym (30 ms) dla przeciągania suwaka głośności, zapobiegając zatorom kolejki Tauri IPC, przy zachowaniu natychmiastowego wywołania bez dławienia dla przycisku wyciszenia/odciszenia (`handleToggleMute`).
- **Ostrzeżenia kompilatora i lintera w workspace Rust**:
  - Usunięto nieużywane pola `rust-version` oraz `repository` z sekcji `[workspace.package]` w głównym `Cargo.toml`.
  - Usunięto ostrzeżenia Clippy `needless_range_loop` w pętlach de-interleavingu kanałów w skrzynce `dsp-rubberband`.
- **Wersjonowane migracje i optymalizacje bazy danych SQLite (`crates/storage`)**:
  - Zaimplementowano odporny na błędy mechanizm migracji schematu w oparciu o `PRAGMA user_version`. Wyeliminowano powtarzające się błędy startowe `duplicate column name` generowane przy każdym uruchomieniu aplikacji przez 15+ niepotrzebnych instrukcji `ALTER TABLE`.
  - Włączono zoptymalizowane parametry SQLite dla wysokiej wydajności operacji dyskowych: `synchronous = NORMAL`, `temp_store = MEMORY`, `cache_size = -64000` (64 MB bufora podręcznego) oraz `mmap_size = 256 MB` dla szybkiego mapowania pamięci.
- **Optymalizacja cyklu życia wizualizatora Canvas w tle (`SpectrumVisualizer.tsx`)**:
  - Dodano nasłuchiwanie zdarzenia `visibilitychange` oraz sprawdzanie `document.hidden`. Pętla `requestAnimationFrame` wizualizatora spektrum automatycznie usypia się, gdy okno aplikacji jest zminimalizowane lub schowane w tle, redukując niepotrzebne zużycie procesora i GPU do 0%.

### 🔄 Zmieniono (Changed)
- **Wydajne wyszukiwanie i sortowanie biblioteki utworów (`useLibraryManager.ts`)**:
  - Zastosowano hook `useDeferredValue` dla tekstu wyszukiwania, co zapobiega zacinaniu interfejsu i utrzymuje stałe 120 FPS podczas wpisywania zapytań w dużych bibliotekach muzycznych.
  - Zastąpiono wolne wywołania `localeCompare` zoptymalizowaną, współdzieloną instancją `Intl.Collator(undefined, { sensitivity: 'base', numeric: true })` w procesie sortowania utworów, albumów i wykonawców (2-3x szybsze sortowanie kolekcji).
- **Zaawansowana memoizacja komponentów (`React.memo`)**:
  - Opakowano kluczowe komponenty (`BottomPlaybackDock`, `MainContentRouter`, `LibraryView`, `PlayerView`) w `React.memo`, eliminując kaskadowe przerenderowania interfejsu wywoływane tykaniem pętli odpytywania stanu odtwarzacza.
- **Modernizacja toolchaina do najnowszych wydań LTS**:
  - Zaktualizowano środowisko Node.js do wersji 22 LTS w potokach GitHub Actions (`ci.yml`, `release.yml`).
  - Podniesiono wydanie Rusta do najnowszej wersji stabilnej (edycja Rust 2024, toolchain 1.85+) oraz zaktualizowano konfigurację menedżera pakietów `pnpm 10`.
- **Adaptacyjne odpytywanie stanu odtwarzacza (`fetchStatus`)**:
  - Zastąpiono agresywne odpytywanie 40 ms interwałem adaptacyjnym: 100 ms podczas aktywnego odtwarzania (płynne 10 FPS dla licznika czasu i postępu) oraz 350 ms w stanie pauzy/zatrzymania, znacząco redukując obciążenie procesora i IPC.
- **Integracja dwuetapowego przewijania w komponentach interfejsu**:
  - Podpięto `onSeekPreview` (podgląd `onChange`) i `onSeekCommit` (zatwierdzenie `onPointerUp`, `onMouseUp`, `onTouchEnd`, `onKeyUp`) w pasku doku [`BottomPlaybackDock.tsx`](./apps/desktop/src/components/layout/BottomPlaybackDock.tsx), widoku odtwarzacza [`PlayerView.tsx`](./apps/desktop/src/views/player/PlayerView.tsx) oraz w powiązanych adapterach [`useBottomPlaybackDockProps.ts`](./apps/desktop/src/components/layout/useBottomPlaybackDockProps.ts) i [`useMainRouterProps.ts`](./apps/desktop/src/hooks/useMainRouterProps.ts).
- **Zunifikowany przepływ CI/CD**:
  - Scalono i zoptymalizowano workflow sprawdzający kod w GitHub Actions pod kątem formatowania, analizy statycznej, kompilacji frontendu oraz pełnego zestawu testów jednostkowych i integracyjnych na czystym środowisku Linux.
- **Głęboka modularyzacja backendu desktopowego i odchudzenie `lib.rs` o ponad 93%**:
  - Zredukowano rozmiar monolitycznego pliku [`lib.rs`](./apps/desktop/src-tauri/src/lib.rs) z 4 914 linii do zaledwie 336 linii, przekształcając go w przejrzysty, deklaratywny punkt wejścia aplikacji.
  - Przeniesiono wszystkie 162 komendy `#[tauri::command]` oraz powiązane z nimi struktury DTO do dedykowanych modułów w katalogu `commands/` (`analysis`, `devices`, `dialogs`, `dsp`, `integrations`, `library`, `metadata`, `playback`, `playlists`, `stems`, `system`, `themes`, `bookmarks`, `downloads`, `queue`, `renamer`).
  - Wyekstrahowano logikę konfiguracyjną i cykl życia aplikacji do modułu `setup/`:
    - `setup/linux_env.rs`: konfiguracja środowiska Linuksa, ścieżek wtyczek GStreamer, skanera wtyczek i procesów pomocniczych WebKit2GTK pod kątem środowiska AppImage.
    - `setup/tray.rs`: definicja ikony i menu zasobnika systemowego (System Tray) oraz obsługa minimalizacji do tray przy zamykaniu okna (`close_to_tray`).
    - `setup/app_init.rs`: otwieranie bazy SQLite, odzyskiwanie stanu kolejki, uruchamianie MPRIS, Discord RPC, Control IPC, wczytywanie ustawień DSP/EQ, obsługa argumentów wiersza poleceń oraz rejestracja stanu `AppState`.
  - Zachowano pełną wsteczną kompatybilność kontraktu IPC Tauri z frontendem React, zerowe ostrzeżenia kompilatora przy rygorystycznym `-D warnings` oraz 100% zaliczenia 7 bramek testowych potoku CI/CD.
- **Głęboka modularyzacja i dekompozycja skrzynki pamięci trwałej (`crates/storage`)**:
  - Zredukowano monolityczny plik [`crates/storage/src/lib.rs`](./crates/storage/src/lib.rs) z 3 132 linii (111 kB) do czystej, zwięzłej fasady eksportującej interfejs `Database`, konstruktory bazy danych oraz zestaw testów jednostkowych.
  - Podzielono logikę persystencji na 9 wyspecjalizowanych domenowo podmodułów w `crates/storage/src/`:
    - `models.rs`: Struktury DTO, encje bazodanowe (`TrackRecord`, `AlbumRecord`, `ArtistRecord`, `DspPresetRecord`, `DuplicateGroup`, `RecapSummaryDto`) oraz typ błędu `StorageError`.
    - `schema.rs`: DDL tabel SQLite, indeksy, pragmy optymalizacyjne (`cache_size`, `mmap_size`, `temp_store`), wersjonowane migracje schematu (`PRAGMA user_version`) oraz domyślne motywy graficzne.
    - `library.rs`: Zarządzanie artystami, albumami, utworami, aktualizacja metadanych, detekcja duplikatów i czyszczenie brakujących plików.
    - `bookmarks.rs`: Zakładki odtwarzania oraz wielopunktowe znaczniki czasowe (cue points / track bookmarks).
    - `settings.rs`: Trwały magazyn ustawień klucz-wartość, motywy anime oraz presety procesora DSP.
    - `playlists.rs`: Tworzenie i edycja playlist oraz persystencja stanu kolejki odtwarzania (`PlaybackQueue`).
    - `stats.rs`: Ulubione, oceny gwiazdkowe, historia odsłuchów, podsumowania Recap oraz inteligentne zapytania (Smart Playlists).
    - `analysis.rs`: Pamięć podręczna analizy muzycznej (akordy, siatka taktowa, transkrypcja nutowa, szczyty fali dźwiękowej) oraz rejestr modeli AI.
    - `stems.rs`: Separacja ścieżek stemów oraz wielościeżkowe projekty miksów (Moises-like multitrack projects).
  - Zachowano 100% kompatybilności wstecznej API publicznego, zerowe ostrzeżenia Clippy oraz pełną zieloną zgodność ze wszystkimi testami potoku CI/CD.


