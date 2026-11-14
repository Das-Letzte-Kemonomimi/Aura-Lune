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
- **Silnik separacji spektralnej HPSS i Stereo Azimuth**: Wdrożono profesjonalną dekompozycję czasowo-częstotliwościową w domenie STFT (Harmonic-Percussive Source Separation) z filtracją medianową i dekompozycją panoramy stereo (Center/Side). Zastąpiono prymitywne filtry korektora (Biquad EQ Crossover), zapewniając zachowanie transjentów stopy i werbla w pełnym paśmie częstotliwości oraz krystalicznie czyste wokale bez zniekształceń pasmowych.
- **Bezstratny zapis i dekodowanie stereo 44.1 kHz**: Wszystkie stemy (zarówno 4-ścieżkowe, jak i hierarchiczne 6+ ścieżkowe) są od teraz dekodowane i zapisywane w pełnym stereo 44.1 kHz 16-bit PCM z idealną sumą matematyczną 100% z sygnałem oryginalnym.
- **1-klikowe pobieranie modeli AI w Menedżerze Modeli**: Dodano komendę `download_ai_model` ze strumieniowym raportowaniem postępu (`auralune://model-download-progress`), umożliwiającą pobieranie oficjalnych wag sieci neuronowych (HTDemucs v4, Basic Pitch) wprost do `~/.local/share/auralune/models/`.
- **Odsłuch na żywo A/B i natychmiastowy powrót do utworu**: Wprowadzono przełącznik A/B (`Oryginał (Master)` <-> `Miks stemów (Na żywo)`) w studiu projektów stemów oraz mikserze 4-ścieżkowym, z automatycznym ładowaniem w czasie rzeczywistym (IRL) i bezproblemowym zachowaniem pozycji czasowej utworu.
- **Dedykowany przycisk powrotu ze stemów w odtwarzaczu**: Nowy chip statusowy i przycisk w głównym odtwarzaczu (`Miks stemów • [Wróć do utworu]`) umożliwiający natychmiastowy powrót do oryginalnego utworu bez zatrzymywania muzyki.

### 🛠️ Poprawiono (Fixed)
- **Pływające okno modalne Studia Analizy Muzycznej (Music Analysis Studio)**: Wyeliminowano błąd renderowania nieostylowanych, nachodzących na siebie elementów HTML (`Music Analysis Studio`, `Mikser Stemów`, `Projekty Stemów`) bezpośrednio w treści strony. Przebudowano wszystkie widoki modułu analizy (`MusicAnalysisModal`, `StemMixerModal`, `ChordTimelineView`, `PianoRollCanvas`, `ModelManagerModal`) z klas Tailwind na spójne, natywne style inline z tokenami anime glassmorphism (`position: fixed`, `zIndex: 10000`, rozmycie tła, wycentrowany kontener o wymiarach 1200x88vh, estetyczne zakładki nawigacyjne).
- **Tryb osadzony (embedded) dla miksera stemów i modeli AI**: Wprowadzono właściwość `embedded` eliminującą powielone nagłówki i przyciski zamknięcia wewnątrz zakładek Studia Analizy.
- **Zachowanie oryginalnego utworu w kolejce**: Usunięto błąd podmiany metadanych utworu na pusty byt przy ładowaniu multitracku stemów — oryginalny plik, tytuł, wykonawca, okładka i album pozostają w pełni nienaruszone.
- **Usunięcie manualnego przycisku ładowania do potoku**: Zastąpiono niewygodny przycisk „Załaduj do potoku audio” w pełni automatycznym, natychmiastowym ładowaniem na żywo (IRL).

### 🔄 Zmieniono (Changed)
- *(brak oczekujących wpisów — dodaj opis zmiany konfiguracji/architektury podczas implementacji)*

### 🔄 Zmieniono (Changed)
- *(brak oczekujących wpisów — dodaj opis zmiany konfiguracji/architektury podczas implementacji)*
