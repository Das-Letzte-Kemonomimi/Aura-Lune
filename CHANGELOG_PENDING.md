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
- *(Brak oczekujących zmian — wersja 0.7.0 została pomyślnie wydana)*

### 🛠️ Poprawiono (Fixed)
- **Zapamiętywanie pozycji przewijania listy albumów (Scroll Memory)**: Naprawiono resetowanie pozycji scrolla do samej góry po kliknięciu w dany album i powrocie przyciskiem „Wróć do wszystkich albumów”. Kontener biblioteki zapamiętuje teraz dokładną pozycję przewijania w momencie wejścia w album i bezszwowo przywraca ją przy powrocie (zarówno w widoku siatki kafelków, jak i listy), eliminując konieczność ponownego przewijania długiej biblioteki.
- **Restart odtwarzania w trybie zapętlenia (Loop)**: Naprawiono błąd, w którym po dojściu utworu do końca (EOS) przy włączonym trybie `Loop Track` lub `Loop Queue` (dla pojedynczego utworu) dźwięk milkł, a pasek postępu odliczał czas na pustym potoku. Nieskuteczne wywołanie `seek(0)` na zablokowanym potoku po EOS zastąpiono deterministycznym przeładowaniem URI (`load_uri`) i płynnym wznowieniem odtwarzania od początku strumienia. Dodano testy integracyjne potwierdzające automatyczny powrót do stanu `Playing` z poprawnym resetem pozycji.

### 🔄 Zmieniono (Changed)
- *(Brak)*

### ⚡ Wydajność i Architektura (Performance & Internal)
- *(Brak)*
