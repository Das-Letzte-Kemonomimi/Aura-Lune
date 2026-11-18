# CHANGELOG_PENDING.md — Rejestr zmian roboczych (Changelog Staging)

> **INSTRUKCJA DLA AGENTA I DEWELOPERÓW:**
> 1. Za każdym razem, gdy wprowadzasz nową funkcję, poprawkę błędu lub refaktor, **musisz dopisać podsumowanie zmiany w odpowiedniej sekcji poniżej**.
> 2. Nie czekaj do momentu wydania — rejestruj zmiany na bieżąco zwięzłym, przejrzystym opisem.
> 3. Podczas przygotowywania nowego wydania (np. bumpu wersji do kolejnego numeru):
>    - Wszystkie zebrane poniżej punkty są weryfikowane i przenoszone do pliku [`CHANGELOG.md`](./CHANGELOG.md) pod nowym nagłówkiem wersji `## [X.Y.Z] — „Kryptonim” - YYYY-MM-DD`.
>    - Poniższe sekcje są czyszczone do stanu początkowego na kolejny cykl deweloperski.
>    - Nowa wersja jest również dodawana do komponentu [`ChangelogView.tsx`](./apps/desktop/src/components/ChangelogView.tsx).

---

## Oczekujące zmiany na kolejne wydanie (Unreleased / Next Release)

### ✨ Dodano (Added)
- **Płynny podgląd i dwuetapowe przewijanie utworów**:
  - Wprowadzono natychmiastową reakcję suwaka pozycji (60/120 FPS) podczas przeciągania myszą lub dotykiem, bez zacinania dźwięku i bez wysyłania zbędnych zapytań w trakcie ruchu.
  - Właściwy skok odtwarzania następuje dopiero po zwolnieniu suwaka (`onPointerUp`, `onMouseUp`, `onTouchEnd`, `onKeyUp`).
- **Niezależne operacje w tle (brak zacinania interfejsu)**:
  - Wszystkie komendy backendu korzystające z bazy danych SQLite i sieci (zakładki, motywy, playlisty, presety DSP, statystyki, skanowanie ReplayGain i okładki) działają teraz w pełni asynchronicznie w puli wątków Tokio, dzięki czemu interfejs odtwarzacza zawsze działa płynnie.
- **Szybsze uruchamianie programu dzięki ładowaniu okien na żądanie**:
  - Zastosowano podział kodu (`React.lazy`) dla 28 modali narzędziowych i analitycznych (m.in. w `AppModalsContainer.tsx`, `TapeDeckWidget.tsx`, `VinylTurntable.tsx`).
  - Zmniejszono główną paczkę startową JavaScript o 20% (około 380 kB mniej kodu pobieranego przy uruchomieniu aplikacji).
- **Wygodniejszy instalator Linuksa z osobnym kanałem deweloperskim (`install.sh`)**:
  - Dodano możliwość instalacji wersji deweloperskiej (`auralune-dev`) równolegle ze stabilną (`auralune`), bez nadpisywania plików i ustawień.
  - Wbudowano automatyczne wykrywanie wtyczek GStreamera w systemie użytkownika, zapobiegając brakowi dźwięku na dystrybucjach typu Arch Linux.
- **Automatyczne budowanie wersji testowych w GitHub Actions (`ci.yml`)**:
  - Każda zmiana w gałęzi deweloperskiej automatycznie tworzy i publikuje świeżą paczkę AppImage z oznaczeniem `dev`, gotową do pobrania przez instalator.
- **Uniwersalny skrypt weryfikacji całego projektu (`tests/run_all_tests.sh`)**:
  - Przygotowano 7-stopniowy zestaw sprawdzający: formatowanie kodu Rusta, testy jednostkowe frontendu, poprawność typów TypeScript, linter Rust Clippy, testy jednostkowe i integracyjne backendu, test dymny oraz poprawność skryptów powłoki.
  - Dodano poręczne przełączniki: `--fix` (automatyczne formatowanie), `--fast` (szybkie testy bez ciężkich prób audio) oraz `--bundle` (lokalny test paczkowania AppImage).
- **Nowe dokumenty dla deweloperów**:
  - Utworzono plik [`DEVELOPMENT.md`](./DEVELOPMENT.md) z opisem konfiguracji środowiska, komend testowych i procesu budowania wydań.
- **Duże rozszerzenie testów automatycznych**:
  - **Pamięć i baza danych**: dodano testy inteligentnych playlist, progów ocen, wykrywania nagrań Hi-Res, odnajdywania duplikatów, podsumowań Recap oraz trwałości kolejki.
  - **Silnik audio i DSP**: przetestowano edytor metadanych (w tym polskie znaki diakrytyczne i odporność na uszkodzone pliki) oraz zachowanie dźwięku przy skrajnych poziomach głośności i gwałtownym przewijaniu.
  - **Parsery i integracja z systemem**: dodano testy arkuszy CUE (z przerwami pregap), playlist M3U/M3U8 oraz komend sterowania przez Waybar i IPC.
  - **Interfejs użytkownika**: przetestowano wyłącznik czasowy (Sleep Timer z łagodnym wyciszaniem), formatowanie czasu, normalizację tekstu oraz dok odtwarzacza.

### 🛠️ Poprawiono (Fixed)
- **Płynne wyciszanie przy przewijaniu (Smooth Seek Fade)**:
  - Naprawiono błąd, przez który puszczenie suwaka pozycji ignorowało włączoną opcję łagodnego wyciszania.
  - Opcja działa teraz spójnie we wszystkich widokach aplikacji: głównym pasku doku, widoku odtwarzacza, trybie pełnoekranowym, Mini Playerze, nakładce tekstu piosenki, widoku fali dźwiękowej oraz osi akordów.
  - Zastosowano delikatne, studyjne mikro-wygaszenie (20–48 ms), które skutecznie usuwa wszelkie trzaski i stuki w głośnikach lub słuchawkach podczas skoków w utworze.
- **Natychmiastowa reakcja suwaka głośności**:
  - Usunięto sztuczne opóźnienia w wątku audio przy zmianie głośności. Regulacja poziomu działa teraz w ułamku mikrosekundy, a nowe ruchy suwaka natychmiast przerywają poprzednie operacje.
- **Koniec z cofaniem i szarpaniem suwaków (rubberbanding)**:
  - Zabezpieczono suwaki czasu i głośności tak, aby regularne odpytywanie stanu z backendu nie nadpisywało pozycji w trakcie trwania gestu użytkownika.
- **Płynna regulacja głośności bez zatykania komunikacji**:
  - Zastosowano łagodne dławienie (30 ms) częstych zdarzeń przeciągania suwaka głośności, zachowując jednocześnie natychmiastową reakcję dla przycisku wyciszenia/odciszenia.
- **Szybsza i stabilniejsza baza danych SQLite**:
  - Wprowadzono bezpieczny mechanizm aktualizacji bazy danych w oparciu o wersję schematu (`PRAGMA user_version`), usuwając błędy o powielonych kolumnach przy starcie programu.
  - Zwiększono pamięć podręczną SQLite (do 64 MB) i włączono szybki tryb zapisu w pamięci RAM oraz mapowanie pamięci (mmap), co zauważalnie przyspiesza działanie aplikacji na dużych bibliotekach.
- **Zmniejszone zużycie procesora i baterii przez wizualizator**:
  - Animacja analizatora widma (`SpectrumVisualizer.tsx`) automatycznie zatrzymuje się, gdy okno programu jest zminimalizowane lub schowane w tle, redukując zużycie GPU i CPU do zera.
- **Poprawki w procesie budowania paczek AppImage**:
  - Dodano brakujące pakiety systemowe do potoku CI na GitHubie, co rozwiązało problem z wykrywaniem bibliotek wskaźników zasobnika systemowego.
- **Bezpieczeństwo pobierania instalatora**:
  - Zabezpieczono instalator uruchamiany z gałęzi stabilnej przed przypadkowym pobraniem wersji testowych.
  - Naprawiono obsługę kanału deweloperskiego, aby w razie opóźnienia wydań na GitHubie nie pobierał po cichu przestarzałych wersji stabilnych.

### 🔄 Zmieniono (Changed)
- **Błyskawiczne wyszukiwanie i sortowanie w bibliotece**:
  - Zastosowano odroczoną aktualizację wyników (`useDeferredValue`), dzięki czemu wpisywanie tekstu w polu wyszukiwania nie zacina interfejsu (stabilne 120 FPS nawet w bardzo dużych kolekcjach).
  - Przyspieszono sortowanie utworów, albumów i artystów (2–3x szybsze działanie dzięki `Intl.Collator`) z pełnym uwzględnieniem polskich reguł językowych.
- **Mniejsze obciążenie komputera w spoczynku**:
  - Odtwarzacz sprawdza stan co 100 ms podczas odtwarzania muzyki, a w stanie pauzy lub zatrzymania co 350 ms, zmniejszając niepotrzebne zużycie procesora.
- **Lepsza płynność interfejsu dzięki memoizacji komponentów**:
  - Kluczowe komponenty ekranu (`BottomPlaybackDock`, `PlayerView`, `LibraryView`) zostały zoptymalizowane za pomocą `React.memo`, eliminując zbędne przerysowywanie całego okna przy każdym tyknięciu licznika czasu.
- **Porządki w kodzie aplikacji desktopowej (`apps/desktop/src-tauri`)**:
  - Skrócono monolityczny plik `lib.rs` z 4914 linii do zaledwie 336 linii.
  - Wszystkie 162 komendy aplikacji przeniesiono do czytelnych, tematycznych plików w katalogu `commands/` (m.in. odtwarzanie, biblioteka, korektor graficzny, motywy, zakładki, urządzenia).
  - Logikę startową i menu zasobnika systemowego wyodrębniono do osobnego modułu `setup/`.
- **Uporządkowanie modułu pamięci podręcznej i bazy danych (`crates/storage`)**:
  - Podzielono duży plik `lib.rs` na 9 mniejszych, wyspecjalizowanych plików w `src/` (zarządzanie biblioteką, zakładki, ustawienia, statystyki, stemmy, itp.), co znacznie ułatwia czytanie i rozwijanie kodu.
- **Kompleksowe wydzielenie testów ze źródeł produkcyjnych do osobnych plików (`tests/`)**:
  - Usunięto wewnętrzne bloki testowe (`#[cfg(test)]`) z produkcyjnych plików źródłowych we wszystkich modułach Rusta (`storage`, `domain`, `metadata`, `downloads`, `dsp-api`, `desktop-integration`, `audio-engine` oraz `src-tauri`).
  - Wszystkie testy przeniesiono do przejrzystych plików w dedykowanych folderach `tests/` lub wydzielonych modułach testowych.
  - Dzięki temu kod produkcyjny jest znacznie krótszy i bardziej przejrzysty, testy kompilują się równolegle, a plik `crates/storage/src/lib.rs` zmniejszył się z 694 linii do zaledwie **74 linii**.
- **Aktualizacja narzędzi deweloperskich**:
  - Zaktualizowano środowisko do Node.js 22 LTS, menedżera pnpm 10 oraz najnowszej stabilnej wersji kompilatora Rust (edycja 2024).
