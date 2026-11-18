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
- **Nowe standardy jakości, instrukcje deweloperskie i CI**:
  - Utworzono dokument [`DEVELOPMENT.md`](./DEVELOPMENT.md) jako pojedyncze źródło prawdy dla konfiguracji środowiska, uruchamiania testów jednostkowych/integracyjnych, linterów i budowania wydań produkcyjnych.
  - Zaktualizowano [`AGENTS.md`](./AGENTS.md) oraz wszystkie powiązane skille agentowe (`skills/quality/i18n-sync`, `skills/backend/tauri2-architecture`, `skills/audio/audio-dsp-safety`, `skills/frontend/react-monolith-refactor`) o bezwzględny protokół sprawdzania kodu przed commitem (`cargo fmt`, `cargo clippy -D warnings`, `eslint`, `build`, `./tests/run_all_tests.sh`).
- **Rozszerzone testy jednostkowe kontrolera odtwarzacza**:
  - Dodano do `src/hooks/usePlaybackController.test.ts` dedykowane testy weryfikujące optymistyczny podgląd przewijania bez wywołań IPC oraz poprawne przekazywanie skoku bez zbędnego wygaszania.

### 🛠️ Poprawiono (Fixed)
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

### 🔄 Zmieniono (Changed)
- **Modernizacja toolchaina do najnowszych wydań LTS**:
  - Zaktualizowano środowisko Node.js do wersji 22 LTS w potokach GitHub Actions (`ci.yml`, `release.yml`).
  - Podniesiono wydanie Rusta do najnowszej wersji stabilnej (edycja Rust 2024, toolchain 1.85+) oraz zaktualizowano konfigurację menedżera pakietów `pnpm 10`.
- **Adaptacyjne odpytywanie stanu odtwarzacza (`fetchStatus`)**:
  - Zastąpiono agresywne odpytywanie 40 ms interwałem adaptacyjnym: 100 ms podczas aktywnego odtwarzania (płynne 10 FPS dla licznika czasu i postępu) oraz 350 ms w stanie pauzy/zatrzymania, znacząco redukując obciążenie procesora i IPC.
- **Integracja dwuetapowego przewijania w komponentach interfejsu**:
  - Podpięto `onSeekPreview` (podgląd `onChange`) i `onSeekCommit` (zatwierdzenie `onPointerUp`, `onMouseUp`, `onTouchEnd`, `onKeyUp`) w pasku doku [`BottomPlaybackDock.tsx`](./apps/desktop/src/components/layout/BottomPlaybackDock.tsx), widoku odtwarzacza [`PlayerView.tsx`](./apps/desktop/src/views/player/PlayerView.tsx) oraz w powiązanych adapterach [`useBottomPlaybackDockProps.ts`](./apps/desktop/src/components/layout/useBottomPlaybackDockProps.ts) i [`useMainRouterProps.ts`](./apps/desktop/src/hooks/useMainRouterProps.ts).
- **Zunifikowany przepływ CI/CD**:
  - Scalono i zoptymalizowano workflow sprawdzający kod w GitHub Actions pod kątem formatowania, analizy statycznej, kompilacji frontendu oraz pełnego zestawu testów jednostkowych i integracyjnych na czystym środowisku Linux.
