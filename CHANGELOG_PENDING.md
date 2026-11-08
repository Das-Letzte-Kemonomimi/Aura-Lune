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
- **Kompleksowe zróżnicowanie wizualne nośników w TapeDeckWidget**:
  - `FE-I` (Ferro): rdzawo-brązowa taśma, klasyczne szpule z tłoczonego aluminium, bursztynowe akcenty LED.
  - `CR-II` (Chrome): głęboko grafitowa/antracytowa taśma, nowoczesne tytanowe szpule, cyjanowe akcenty LED.
  - `METAL`: metaliczna taśma gunmetal, luksusowe szpule NAB ze szczotkowanego złota champagne, złote akcenty LED.
- **Dynamiczna symulacja prędkości taśmy (7½ vs 3¾ IPS)**: dwukrotne przyspieszenie obrotów szpul, rolki dociskowej (pinch roller) oraz mechanicznego licznika taśmy.
- **Zintegrowany popover parametrów Lo-Fi FX w magnetofonie szpulowym**: szybki dostęp do konfiguracji szumu i trzasków z poziomu panelu taśmy.
- **Persystencja parametrów analogowych**: zapamiętywanie wybranego RPM winylu (33/45), typu taśmy (FE-I/CR-II/METAL) oraz prędkości taśmy (7.5/3.75 IPS) w `localStorage`.

### 🛠️ Poprawiono (Fixed)
- **Obcinanie okna parametrów Analog Lo-Fi FX**: zmieniono `overflow` na `visible` oraz zakotwiczono popover bezpośrednio w granicach karty widgetu (`left: 10px, right: 10px, width: auto`), eliminując ucinanie prawej krawędzi.
- **Dopasowanie szerokości widoku Now Playing**: rozszerzono kolumnę widgetów z 240px do 275px (rozmiar widgetów 265px) w trybach Vinyl, Tape i VU, zapewniając swobodne rozmieszczenie elementów sterujących bez ścisku.
- **Reaktywność opcji wizualnych gramofonu**: kliknięcie 33⅓ vs 45 RPM natychmiast zmienia prędkość obrotową (190 vs 285 deg/s), kąt prowadzenia ramienia gramofonowego (tonearm) oraz dynamicznie aktualizuje dolny badge statusu w `App.tsx`.

### 🔄 Zmieniono (Changed)
- *(Brak oczekujących zmian — sekcja zresetowana po wydaniu v0.9.4)*

### ⚡ Wydajność i Architektura (Performance & Internal)
- *(Brak oczekujących zmian — sekcja zresetowana po wydaniu v0.9.4)*
