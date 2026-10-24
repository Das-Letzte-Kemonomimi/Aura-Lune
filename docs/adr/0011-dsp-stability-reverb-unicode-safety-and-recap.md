# ADR 0011: Audio DSP Engine Stability, Reverb, Japanese Unicode Safety, Listening Stats, and Onboarding

## Kontekst
Użytkowniczka zgłosiła szereg uwag funkcjonalnych i stabilnościowych dotyczących odtwarzacza Auralune:
1. **Drag & Drop**: upuszczanie folderów z muzyką powodowało zawieszanie aplikacji, ponieważ foldery były dodawane bezpośrednio jako elementy kolejki bez rekurencyjnego przeszukiwania plików audio, a operacje bazodanowe blokowały wątki wykonawcze.
2. **Bezpieczeństwo ścieżek z japońskimi znakami**: pliki i katalogi zawierające japońskie znaki (Kanji, Hiragana, Katakana) lub spacje wywoływały błędy w dekoderze GStreamera (`uridecodebin`), który wymaga bezwzględnie poprawnego formatu URI (RFC 3986) z kodowaniem procentowym (`url::Url::from_file_path`).
3. **Artefakty Rubber Band (< 0.50x)**: przy ekstremalnym spowolnieniu dźwięku domyślny tryb detekcji transjentów generował metaliczne trzaski i szum. Wymagane jest włączenie wygładzania transjentów (`RUBBERBAND_OPTION_TRANSIENTS_SMOOTH`) oraz wydłużonego okna analizy (`RUBBERBAND_OPTION_WINDOW_LONG`).
4. **Skok suwaka czasu przy zmianie parametrów DSP i przewijaniu +/- 5s**: redundantna rekalkulacja pozycji na podstawie `speed` powodowała gwałtowne przesunięcia osi czasu przy zmianie semitonów. Podczas przewijania bufor wstępny potoku chwilowo zwracał 0, powodując powrót wskaźnika do początku utworu.
5. **Reverb DSP (Slowed + Reverb)**: brak efektu pogłosu. GStreamer dostarcza natywny, zoptymalizowany element `freeverb` z regulacją `room-size`, `damping`, `width` i `level`.
6. **Wideo w tle (Animated Video Background)**: możliwość uruchomienia zapętlonego wideo (MP4/WebM) w warstwie tła z zachowaniem rozmycia i nakładki.
7. **Klucz i Tempo (Key & BPM)**: dynamiczny kalkulator transpozycji klucza i wypadkowego tempa z uwzględnieniem pitch shiftu i time stretchingu.
8. **Statystyki odsłuchów i Auralune Recap (Unwrapped)**: zliczanie rzeczywistego czasu odtwarzania per utwór (`total_play_time_ms`) oraz historia odsłuchów (`listening_history`) umożliwiająca podsumowania tygodniowe, miesięczne i roczne w 100% lokalnie.
9. **Onboarding i Zrzeczenie Odpowiedzialności**: krótki (2-3 krokowy) kreator pierwszego uruchomienia z osobistą notą autorki oraz klauzulą wyłączenia odpowiedzialności (as-is / no warranty).

## Decyzje architektoniczne
1. **Potok Audio**:
   - `uridecodebin` otrzymuje wyłącznie znormalizowane i procentowo zakodowane URI przez `url::Url::from_file_path`.
   - Łańcuch przetwarzania audio: `uridecodebin -> audioconvert -> audioresample -> capsfilter -> AuraluneDsp -> freeverb -> equalizer -> queue_sink -> spectrum -> audioconvert_out -> volume -> sink`.
   - Umieszczenie analizatora `spectrum` tuż przed wyjściem audio eliminuje 500 ms opóźnienia i gwarantuje idealną synchronizację wizualizacji przy zwolnionym tempie.
2. **Kolejkowanie Drag & Drop**:
   - `add_uris_to_queue` asynchronicznie rozwija katalogi przy użyciu `walkdir`, filtrując rozszerzenia audio i natychmiast aktualizuje kolejkę bez blokowania UI.
3. **Pomiary Czasu i Recap**:
   - Tabela `tracks` otrzymuje kolumnę `total_play_time_ms`.
   - Dodano tabelę `listening_history` z indeksem na znacznik czasu odsłuchu.
   - Nowy komponent `AuraluneRecapModal` prezentujący podsumowanie tygodnia, miesiąca i roku na życzenie użytkowniczki.
4. **Onboarding**:
   - `OnboardingModal` wyświetlany wyłącznie przy pierwszym uruchomieniu programu, zawierający genezę projektu, klauzulę prawną i opt-in do statystyk Recap.

## Konsekwencje
- Poprawiona stabilność odtwarzania przy plikach z dowolnymi znakami Unicode.
- Płynny odsłuch utworów slowed/reverb bez artefaktów i trzasków.
- Prawidłowe działanie skrótów klawiszowych i suwaka bez resetowania pozycji.
- Transparentność prawna i lokalne, prywatne statystyki odtwarzania.
