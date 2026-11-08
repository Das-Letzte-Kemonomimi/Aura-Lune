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
- *(Brak oczekujących zmian — sekcja zresetowana po wydaniu v1.0.0)*

### 🛠️ Poprawiono (Fixed)
- **Kąt ramienia gramofonu (VinylTurntable)**: Poprawiono kierunek wychylenia ramienia przy odtwarzaniu (`-22deg` dla 33⅓ RPM, `-27deg` dla 45 RPM) oraz kąt wkładki igły (`+15deg`), dzięki czemu igła stabilnie spoczywa na rowkach płyty winylowej zamiast wychodzić poza obrys gramofonu na prawo.
- **Równowaga stereo i ballistyka VU-Metera (VuMeterWidget)**: Usunięto podział pasm częstotliwościowych FFT, który sztucznie traktował wysokie tony jako prawy kanał, powodując zaniżanie wskazań prawej igły do -11.8 dB. Wprowadzono pełnopasmową analizę psychoakustyczną z mikro-dynamiką stereo dla obu kanałów.

### 🔄 Zmieniono (Changed)
- *(Brak oczekujących zmian — sekcja zresetowana po wydaniu v1.0.0)*

### ⚡ Wydajność i Architektura (Performance & Internal)
- *(Brak oczekujących zmian — sekcja zresetowana po wydaniu v1.0.0)*
