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
- **Akustyczny Fingerprinting i Autotagowanie (Chromaprint / AcoustID)**: Pełna integracja z narzędziem `fpcalc` oraz serwisem AcoustID REST API (`crates/metadata/src/acoustid.rs`). Umożliwia 1-klikowe rozpoznawanie nieznanych utworów audio po samej fali dźwiękowej, automatyczne uzupełnianie tagów i wybór wydań w oknie `TagEditorModal`.
- **Symulator Brzmienia Winylowego & Taśmy (Lo-Fi Vinyl & Tape Noise FX)**: Autorski silnik syntezy szumu analogowego (`apps/desktop/src/utils/vinylSimulator.ts`) zintegrowany bezpośrednio z widokiem gramofonu `VinylTurntable`. Zawiera realistyczne trzaski kurzu (dust crackle), szum rowka winylowego z modulacją obrotową 33⅓/45 RPM, basowe dudnienie igły (stylus rumble) oraz szum taśmy chromowej (Tape Hiss) z regulacją poziomu (0-100%) i automatycznym wyciszaniem na pauzie.
- **Retro Magnetofon Szpulowy / Kaseta (`TapeDeckWidget`)**: Dedykowany 4. tryb wizualny w głównym odtwarzaczu Now Playing obok Okładki, Winylu i VU-Metera. Wierne odwzorowanie studyjnego magnetofonu szpulowego z obracającymi się szpulami aluminiowymi NAB, fizycznym przemieszczaniem nawoju taśmy z lewej na prawą szpulę zależnym od pozycji w utworze, mechanicznym 4-cyfrowym licznikiem obrotów i przełącznikiem 7½ / 3¾ IPS.

### 🛠️ Poprawiono (Fixed)
- *(Brak oczekujących zmian — sekcja zresetowana po wydaniu v0.9.3)*

### 🔄 Zmieniono (Changed)
- *(Brak oczekujących zmian — sekcja zresetowana po wydaniu v0.9.3)*

### ⚡ Wydajność i Architektura (Performance & Internal)
- *(Brak oczekujących zmian — sekcja zresetowana po wydaniu v0.9.3)*
