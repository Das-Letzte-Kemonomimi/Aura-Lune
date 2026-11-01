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
- **GitHub Actions CI/CD Pipeline (`CI/CD Pipeline / Tests & Quality Checks`)**: Skonfigurowano automatyczny potok weryfikacji jakości kodu przy każdym Pull Requeście oraz pushu na gałęzie `main` i `dev`. Potok automatycznie sprawdza formatowanie Rust (`cargo fmt`), reguły lintera (`cargo clippy`), uruchamia testy (`cargo test`) oraz kompiluje frontend z walidacją typów TypeScript (`npm run build`).

### 🛠️ Poprawiono (Fixed)
- **Synchronizacja i nazewnictwo punktów pętli A-B przy eksporcie**: Usunięto błąd, w którym po ustawieniu nowych punktów pętli w odtwarzaczu formularz eksportu zachowywał stare wartości z poprzedniego eksportu. Dodano automatyczną synchronizację aktywnej pętli i nazwy pliku wyjściowego (`_loop_start-end`) przy wejściu do transkodowania oraz po zmianie punktów.
- **Obsługa przecinków i formatów czasu w polach eksportu**: Rozszerzono `parseTimeToMs` o obsługę przecinków dziesiętnych (np. `0:22,449`) oraz prefiksów `A:` i `B:`.
- **Walidacja zakresu eksportu**: Poprawiono odblokowywanie przycisku eksportu w razie nieprawidłowej kolejności punktów (zapobieganie zawieszeniu w stanie ładowania).

### 🔄 Zmieniono (Changed)
- Zapewniono automatyczne czyszczenie i odświeżanie sufiksów `_loop_...` w ścieżce docelowej transkodowania przy przełączaniu formatów oraz punktów cięcia.

### ⚡ Wydajność i Architektura (Performance & Internal)
- Dodano test integracyjny `test_transcode_different_ranges_with_rubberband_slowed` weryfikujący precyzję cięcia kolejnych fragmentów A-B w potoku GStreamera z RubberBandem.
- Wyeliminowano potencjalny race-condition w `DiscordRpcController::set_enabled` i `set_client_id` poprzez natychmiastową synchronizację statusu w `RwLock`.
