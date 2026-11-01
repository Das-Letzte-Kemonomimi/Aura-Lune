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
- *(Brak)*

### 🛠️ Poprawiono (Fixed)
- **Eliminacja awarii (SIGABRT/panic) przy edycji pasm w PEQ Studio**: naprawiono przekazywanie wartości wzmocnienia powyżej +12.0 dB do elementu GStreamera `equalizer-nbands`. GStreamer wymusza ścisły zakres właściwości `gain` od -24.0 dB do +12.0 dB; przekroczenie powodowało panikę w warstwie glib FFI i awarię aplikacji. Wprowadzono bezpieczne obcinanie `clamp(-24.0, 12.0)` w silniku audio oraz zsynchronizowano zakresy w domenie `crates/domain/src/parametric_eq.rs`.
- **Działanie pasm użytkownika i automatyczna aktywacja**: usunięto problem, w którym modyfikowane pasma użytkownika nie wpływały na brzmienie przy wyłączonym głównym przełączniku bypass. Każda zmiana pasma (suwak, przeciąganie węzła na wykresie, zmiana częstotliwości/Q/typu filtru, dodanie/usunięcie pasma) automatycznie włącza korektor parametryczny (`enabled: true`), a w oknie dodano dynamiczny wskaźnik stanu informujący, czy filtry biquad są aktywne w locie.

### 🔄 Zmieniono (Changed)
- Zaktualizowano skalę osi Y wykresu odpowiedzi częstotliwościowej oraz suwaki pasm w `ParametricEqModal.tsx` z -24..+24 dB do rzeczywistego zakresu filtrów GStreamera: -24..+12 dB.

### ⚡ Wydajność i Architektura (Performance & Internal)
- Wdrożono trailing throttle (35 ms) dla wywołań Tauri IPC (`set_parametric_eq_state`) podczas płynnego przeciągania węzłów na wykresie SVG (eliminacja lawinowych 100+ wywołań na sekundę i obciążenia potoku audio).
- Zabezpieczono właściwość `num-bands` w potoku GStreamera przed zbędnym resetowaniem tablicy pasm przy identycznej liczbie pasm oraz ograniczono maksymalną liczbę pasm do 64.
