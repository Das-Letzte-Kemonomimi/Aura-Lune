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
- **Moises-Style Stem Projects Studio (Kaskadowa Separacja i Wielokanałowy Mikser Stemów)**:
  - Dedykowana encja projektu stemów (`StemProject`) powiązana hashem z oryginalnym utworem bez jakiejkolwiek modyfikacji plików biblioteki.
  - Hierarchiczna, wielopoziomowa taksonomia stemów (Wokale: główny, chórki; Perkusja: stopa, werbel, tomy, hi-hat, talerze; Bas: elektryczny/syntezatorowy; Gitary: akustyczna, elektryczna rytmiczna/prowadząca; Klawisze: pianino, pady; Orkiestra: smyczki, dęte).
  - Matematyczna gwarancja rekonstrukcji $\sum \text{stemy pochodne} = \text{stem nadrzędny}$ oraz $\sum \text{stemy liściowe} = \text{oryginał} \pm 10^{-6}$ dzięki kaskadzie filtrów Linkwitz-Riley biquad i zachowaniu składowych resztkowych (*exact residual preservation*).
  - Studyjny mikser wielościeżkowy z suwakami głośności 0–100% (domyślnie 75% = 0 dB unity gain, 0% = wyciszenie, 100% = +6.02 dB headroom boost; krzywa logarytmiczno-kwadratowa z dwuklikiem resetującym do 75%).
  - Płynne miksowanie w locie bez trzasków i alokacji w callbacku audio zintegrowane z GStreamer `audiomixer` oraz łańcuchem procesorów DSP (Rubber Band, SoundTouch, EQ, True-Peak Limiter).
  - Presety miksu (Karaoke, Acapella, Drums Only, Rhythm Section, Instrumental, Practice Guitar), zapisywanie i wczytywanie nazwanych miksów użytkownika w SQLite.
  - Eksport zmiksowanego audio do formatu FLAC/WAV oraz kompletny eksport projektu jako archiwum ZIP.
  - Pakiety modeli w Model Managerze (Baza DSP, Pakiety AI ONNX dla perkusji, wokali i orkiestry) z estymacją czasu przetwarzania.
  - Nowa sekcja w bibliotece „Stem Projects” oraz bezpośredni przycisk tworzenia projektu w widoku pełnoekranowym (Big Screen) i na liście utworów.

### 🛠️ Poprawiono (Fixed)
- **Stabilizacja przewijania i stały nagłówek interfejsu (Fixed Top Header & Non-scrollable Root)**:
  - Zablokowano przewijanie kontenera bazowego okna (`html, body, #root { overflow: hidden; height: 100% }`), dzięki czemu górny pasek nawigacyjny (`<header>`) pozostaje w 100% nieruchomy na samej górze ekranu i nie ucieka z widoku podczas scrollowania.
  - Naprawiono przewijanie w oknie Ustawień (`isSettingsOpen`): dodano wymuszenie elastyczności `minHeight: 0` dla kontenera zawartości pod-zakładek oraz `overflowY: 'auto'` dla tła modalu, gwarantując płynne przewijanie kółkiem myszy i paskiem przewijania bez ucinania dolnych sekcji.
  - Odchudzono przycisk wyboru języka (`LanguageSelector`): usunięto pełny tekst ("English", "Polski") z przycisku głównego, pozostawiając wyłącznie estetyczną ikonę globu 🌐 oraz flagę aktywnego języka (np. 🇬🇧, 🇵🇱), co zaoszczędziło cenne miejsce na pasku narzędzi.
  - Zoptymalizowano szerokość paska narzędziowego i zachowanie skali UI: skrócono zbyt długie etykiety (`Floating Desktop Lyrics Overlay` → `Desktop LRC`, `Harmonic DJ Suggester` → `Harmonic DJ`, `Auralune Settings` → `Ustawienia`/`Settings`), dostosowano media query punktu przełamania tekstu etykiet oraz dodano pełne zapętlenie kliknięć w selektor skali (100% → 110% → 120% → 130% → 100%).

### 🔄 Zmieniono (Changed)
- *(brak oczekujących wpisów — dodaj opis zmiany konfiguracji/architektury podczas implementacji)*
