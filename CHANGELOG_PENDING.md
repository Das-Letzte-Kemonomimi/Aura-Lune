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
- **Pełne zapamiętywanie stanu sesji odtwarzania przy ponownym uruchomieniu (Session Persistence)**:
  - Automatyczne zapamiętywanie i przywracanie: ostatnio odtwarzanego utworu, pozycji w milisekundach (`position_ms`), poziomu głośności (liniowego oraz studyjnego w dB), parametrów DSP oraz trybu widoku po ponownym uruchomieniu aplikacji.
  - Dedykowany, stylowy przełącznik w oknie *Ustawienia -> Audio & Urządzenia* umożliwiający pełną kontrolę i włączenie/wyłączenie zapamiętywania sesji odtwarzania.
  - Hybrydowe utrwalanie stanu: natychmiastowe w `localStorage` (dla zerowej latencji UI) oraz asynchroniczne z buforem w SQLite (`app_settings`), w tym natychmiastowe zapisanie przy `beforeunload`.

### 🛠️ Poprawiono (Fixed)
- *(Brak oczekujących zmian — sekcja zresetowana po wydaniu v0.9.1)*

### 🔄 Zmieniono (Changed)
- *(Brak oczekujących zmian — sekcja zresetowana po wydaniu v0.9.1)*

### ⚡ Wydajność i Architektura (Performance & Internal)
- *(Brak oczekujących zmian — sekcja zresetowana po wydaniu v0.9.1)*
