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
- **Dźwiękowy generator tła (Soundscape / Lofi Ambience)**:
  - Proceduralny silnik syntezy Web Audio API w czasie rzeczywistym z 5 niezależnymi, nieskończonymi warstwami otoczenia:
    1. *Deszcz (Rain)*: szum różowy filtrowany dolnoprzepustowo z modulacją LFO i losowymi kroplami deszczu.
    2. *Winyl (Vinyl crackle)*: trzaski igły gramofonowej i szum powierzchniowy płyty winylowej.
    3. *Ognisko (Campfire)*: głęboki szum brązowy z trzaskającymi iskrami drewna.
    4. *Wiatr i dzwonki Furin (Wind & Chimes)*: podmuchy wiatru z tradycyjnymi japońskimi dzwonkami wiatrowymi Insen/Hirajoshi.
    5. *Kawiarnia / Szum brązowy (Cafe & Brown Noise)*: głęboki szum o nachyleniu 6 dB/oktawę ułatwiający skupienie i naukę.
  - Zestaw gotowych presetów: *Lofi Study ☕*, *Rainy Tokyo 🌧️*, *Sakura Garden 🌸*, *Warm Hearth 🔥*, *Deep Focus 🎧*.
  - Automatyczna synchronizacja z efektami cząsteczkowymi tła anime (Sakura, Deszcz, Iskry).
  - Płynny mikser suwakowy w szklanym oknie modalnym, wyciszanie (mute) oraz zapamiętywanie poziomów w `localStorage`.
- **Harmonic Queue Assistant & DJ Beat-Matched Crossfade**:
  - Inteligentne miksowanie harmoniczne oparte na kole Camelota (Camelot Wheel) i algorytmie dopasowania Mixed In Key.
  - Wykrywanie stopnia harmoniczności: ten sam klucz (100%), zmiana nastroju molowy/durowy (95%), kroki energii ±1 (90%), kroki po przekątnej (85%), modulacja energii semitonowej (+1 semiton / +7 godzin na kole, 80%).
  - Precyzyjne dopasowanie tempa BPM z tolerancją standardu DJ-skiego (±6%) oraz detekcją half-time / double-time (np. 70 BPM <-> 140 BPM, 175 DnB <-> 87.5 Halftime).
  - Dynamiczny **DJ Beat-Matched Crossfade**: obliczanie i aplikowanie czasu przenikania równego 1 taktowi (4 beaty), 2 taktom (8 beatów) lub 4 taktom (16 beatów) aktualnego tempa BPM.
  - Działania jednym kliknięciem: natychmiastowe płynne przejście z crossfade (*Mix Now*), kolejkowanie jako następny utwór (*Play Next*), dodawanie do kolejki oraz funkcja *Sync BPM* dopasowująca suwak tempa silnika DSP do sugerowanego utworu.
- **Baza profili słuchawkowych AutoEQ (1-klikowy Parametric EQ)**:
  - Baza ponad 160 precyzyjnych profili pomiarowych słuchawek nausznych, wokółusznych i dokanałowych IEM od wiodących marek: Moondrop (Chu, Chu II, Aria, Kato, Blessing 2/3, Dusk, Variations), Sennheiser (HD 600, HD 650/6XX, HD 560S, HD 800 S, IE 200/600), Beyerdynamic (DT 770 Pro 80/250, DT 990 Pro, DT 1990 Pro), Sony (WH/WF-1000XM4/XM5, MDR-7506), Apple (AirPods Pro 2, AirPods Max), Hifiman (Sundara, Edition XS, Arya, Ananda), Truthear (Zero:RED, Hexa, Nova), AKG (K371, K240, K702), Tangzu, 7Hz, Koss, Bose i innych.
  - Skalowanie do 10-pasmowego korektora graficznego Auralune (31 Hz - 16 kHz) z kompensacją krzywej Harmana (Harman Over-Ear 2018 / Harman In-Ear 2019v2).
  - Wbudowana ochrona przed przesterowaniem (cyfrowy clipping) dzięki zalecanemu tłumieniu Preamp.
  - Wygładzona wizualizacja krzywej korekcji w modalnym panelu, wyszukiwarka modeli oraz natychmiastowe zastosowanie jednym kliknięciem.

### 🛠️ Poprawiono (Fixed)
- *(Brak)*

### 🔄 Zmieniono (Changed)
- Zintegrowano mikser Soundscape, Harmonic Suggester oraz bazę AutoEQ w menu narzędziowym nagłówka, sekcji korektora DSP oraz w palecie komend (Ctrl+K).
- Dodano wielojęzyczne tłumaczenia (PL, EN, DE, FI, LA) dla nowych funkcji miksowania i korekcji.

### ⚡ Wydajność i Architektura (Performance & Internal)
- Silnik Soundscape wykorzystuje zerowe narzuty I/O dzięki syntezie proceduralnej w pamięci podręcznej Web Audio API (automatyczne zawieszenie AudioContext, gdy wszystkie kanały są wyłączone, redukujące zużycie procesora do 0%).
- Zoptymalizowano indeksowanie i wyszukiwanie kandydatów harmonicznych przy użyciu `useMemo` i wektoryzacji odległości koła zegarowego.


