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
- *(Brak oczekujących zmian — wersja 0.7.3 została pomyślnie wydana)*

### 🛠️ Poprawiono (Fixed)
- **Auralune Recap (Wrapped)**: Usunięto błędy formatowania DTO powodujące wyświetlanie `NaN min` w łącznym czasie słuchania oraz pusty licznik odtworzonych utworów.
- **Top Tracks & Top Artists**: Skorygowano sortowanie w zapytaniach SQLite (eliminacja niesortowanego zachowania złączeń `JOIN`), dodano pełne mapowanie wykonawców i zliczanie odtworzeń w widoku podsumowania, co wyeliminowało puste etykiety `#1 ( plays)`.
- **Discord Rich Presence (RPC) & Repeat / Loop**: Wyeliminowano zawieszanie się paska postępu na końcu utworu (np. `1:48 / 1:48`) w trybach zapętlania (`Repeat Track`, `Repeat All`, pętla A-B). Dodano zdarzenie `PlayerEvent::TrackLooped`, śledzenie cofnięcia pozycji w `get_status` oraz kalkulację estymowanego czasu w `DiscordRpcWorker`, dzięki czemu Discord natychmiast resetuje pasek do `0:00` i odlicza kolejny obieg utworu.

### 🔄 Zmieniono (Changed)
- Rozszerzono `RecapSummaryDto` o pola kompatybilności wstecznej oraz wprowadzono struktury `RecapTopTrackDto` i `RecapTopArtistDto`.

### ⚡ Wydajność i Architektura (Performance & Internal)
- Dodano fallbacki do bazy danych przy zerowej historii odtworzeń (`listening_history`), uwzględniając sumaryczne statystyki z tabeli `tracks`.
