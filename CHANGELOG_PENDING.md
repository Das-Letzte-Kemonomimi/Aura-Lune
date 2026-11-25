# CHANGELOG_PENDING.md — Rejestr zmian roboczych (Changelog Staging)

> **INSTRUKCJA DLA AGENTA I DEWELOPERÓW:**
> 1. Za każdym razem, gdy wprowadzasz nową funkcję, poprawkę błędu lub refaktor, **musisz dopisać podsumowanie zmiany w odpowiedniej sekcji poniżej**.
> 2. Nie czekaj do momentu wydania — rejestruj zmiany na bieżąco zwięzłym, przejrzystym opisem w języku polskim.
> 3. Podczas przygotowywania nowego wydania (np. bumpu wersji do kolejnego numeru):
>    - Wszystkie zebrane poniżej punkty są weryfikowane i przenoszone do pliku [`CHANGELOG.md`](./CHANGELOG.md) pod nowym nagłówkiem wersji `## [X.Y.Z] — „Kryptonim” - YYYY-MM-DD`.
>    - Poniższe sekcje są czyszczone do stanu początkowego na kolejny cykl deweloperski.
>    - Nowa wersja jest również dodawana do pliku danych [`apps/desktop/src/data/changelog.json`](./apps/desktop/src/data/changelog.json) (nie modyfikuj bezpośrednio kodu [`ChangelogView.tsx`](./apps/desktop/src/views/changelog/ChangelogView.tsx)).

---

## Oczekujące zmiany na kolejne wydanie (Unreleased / Next Release)

> Zakres: wszystkie zmiany gałęzi względem `main` (porządki „prepare for refactor”, wydzielenie `App.tsx`, kanał deweloperski instalatora oraz fazy 1–6 przeglądu backendu i frontendu).

### ✨ Dodano (Added)

#### Odtwarzanie i dźwięk
- **Przewijanie przeciąganiem na falogramie** (`WaveformCanvas`) we wszystkich czterech stylach (gładka fala, słupki, przewijana fala DJ, lustrzane spektrum) — mysz i dotyk, z przechwytywaniem wskaźnika, podglądem czasu na żywo i skokiem dopiero po puszczeniu przycisku.
- **Dwuetapowe przewijanie na wszystkich suwakach pozycji**: podczas przeciągania odświeża się tylko podgląd (60/120 FPS, bez zapytań IPC), a przewinięcie z mikro-wyciszeniem (20–48 ms, `seek_with_fade`) następuje po puszczeniu suwaka.
- **Dwa tryby regulacji głośności** w ustawieniach:
  - **natychmiastowy** — zmiana trafia do karty dźwiękowej w mniej niż 15 ms (element `volume` przeniesiono za bufor `queue_sink`, co usunęło ok. 600 ms opóźnienia);
  - **płynny** — przejście po krzywej S (60–120 ms) bez trzasków, również przy wyciszaniu i przywracaniu dźwięku.

- **Zapamiętywanie głośności**: ostatnia głośność jest zapisywana przy zamykaniu aplikacji i przywracana przy starcie, niezależnie od opcji przywracania sesji.

#### Analiza muzyczna (Piano-Roll i MIDI)
- **Piano-Roll od nowa**: ostry obraz przy każdym skalowaniu (bufor w rozdzielczości urządzenia zamiast stałego 900×686), płynny ruch głowicy z częstotliwością odświeżania ekranu, rysowanie tylko widocznych nut i pętla, która śpi podczas pauzy. Tryb „Podążaj” (głowica przy 30% szerokości) oraz tryb swobodny: przeciąganie i kółko myszy przesuwają widok, Ctrl+kółko przybliża oś czasu, kółko przewija wiersze w pionie (gdy się nie mieszczą), Shift+kółko przesuwa czas, a pionowy suwak i przeciąganie w pionie pozwalają przewijać bez wychodzenia z trybu „Podążaj”; znaczniki na krawędziach pokazują nuty ukryte powyżej lub poniżej. Wysokość wierszy ustawisz przyciskami lub Alt+kółko (albo zostawisz „Auto”), a szerokość (zoom czasu) i wysokość są zapamiętywane między sesjami. Dodano linijkę czasu, siatkę uderzeń i taktów z tempa, podświetlanie klawiszy brzmiących nut, podpowiedź nuty (wysokość, start, długość, głośność) i minimapę gęstości nut z widocznym oknem (klik = przewinięcie). Podpisy nut (np. D2, C4) włącza i wyłącza przycisk „Podpisy” (ustawienie jest zapamiętywane); przy włączonych podpisach wiersze mają czytelną wysokość, w trybie „Podążaj” widok pionowy sam śledzi nuty przy głowicy, dopóki nie przewiniesz go ręcznie.

#### Interfejs
- **Historia wydań z paginacją**: dane wydań w pliku [`changelog.json`](./apps/desktop/src/data/changelog.json), wybór 3/5/10 wydań na stronę, skróty do pierwszej/ostatniej strony i wielokropek przy wielu stronach.
- **Przycisk podsumowania Recap** w nagłówku panelu statystyk.
- **Komunikat o błędzie przy nieudanym starcie** (baza danych, katalog danych, GStreamer) w oknie systemowym (zenity/kdialog) zamiast cichej awarii.
- **Kilka komunikatów o błędach naraz** (do 3) — każdy znika po własnym czasie, kliknięcie zamyka komunikat, identyczne komunikaty nie są dublowane.

#### Instalacja, wydania i narzędzia deweloperskie
- **Kanał deweloperski instalatora** (`install.sh`): wersja `auralune-dev` instalowana obok stabilnej, z osobnymi plikami, profilem i skrótami; automatyczne wykrywanie wtyczek GStreamera (np. na Arch Linux).
- **Automatyczne wydania testowe**: każda zmiana w gałęzi deweloperskiej publikuje w GitHub Actions świeży AppImage oznaczony `dev`.
- **Skrypt pełnej weryfikacji** `tests/run_all_tests.sh` (7 etapów jak w CI: `cargo fmt`, oxlint + Vitest, `tsc` + build Vite, Clippy `-D warnings`, testy Rusta, test dymny, `bash -n`) z przełącznikami `--fix`, `--fast` i `--bundle`.
- **Dokumentacja**: przewodnik architektury [`AGENTS.md`](./AGENTS.md) oraz [`DEVELOPMENT.md`](./DEVELOPMENT.md).
- **Znacznie więcej testów automatycznych**, m.in.:
  - baza danych — migracje schematu, kaskady kluczy obcych, kolejność playlist, duplikaty;
  - silnik audio — tryb bit-perfect, długość wyjścia i ciągłość znaczników czasu DSP, niewyrównane bufory, zakleszczenia, kodowanie URI, wykrywanie ciszy;
  - pobieranie — lokalny serwer testowy zamiast zależności od Hugging Face;
  - kontrakt IPC — każde `invoke()` frontendu musi trafiać w zarejestrowaną komendę;
  - format błędów komend i polityka CSP;
  - hooki frontendu — wyłącznik czasowy, skróty klawiaturowe, przeciąganie plików, nasłuchy zdarzeń, komunikaty, trwałe ustawienia.
  - miksowanie harmoniczne (dopasowanie BPM, crossfade w takt, ocena przejść), przeliczenia korektora parametrycznego, zgodność słowników (brak nieaktualnych kluczy, te same znaczniki `{n}` we wszystkich językach);
  - dekodowanie do analizy (uszkodzone pliki, rozdział kanałów, długość), falogram długich utworów, równoważność nowego HPSS ze starą implementacją, ponawianie zapytań HTTP i limit częstotliwości.

---

### 🛠️ Poprawiono (Fixed)
- **Profile DSP (Nightcore, Slowed, …)**: zastosowanie profilu to jedno wywołanie IPC (`apply_dsp_profile`) zamiast sześciu, a przełączenie z Bypass na silnik DSP nie wykonuje już seeku (przebazowanie osi czasu), więc profil włącza się bez przerwy w dźwięku.
- **Ikona kanału dev**: `install.sh` instaluje nową ikonę (lineout) zamiast starej, launcher eksportuje `AURALUNE_CHANNEL`, a aplikacja zapisuje ikonę pod `auralune-dev` i nie nadpisuje wpisu `.desktop` wersji stable.
- **Pełnoekranowy odtwarzacz**: zawartość skaluje się do okna i można ją przewijać zamiast wychodzić poza ekran.
- **Teksty interfejsu**: łączny czas kolejki ("9 godz. 59 min" → "9 h 59 min" w EN itd.), komunikaty błędów kolejki, raport diagnostyczny audio, komunikat o braku akordów i inne ciągi zapisane na sztywno po polsku są teraz tłumaczone przez pliki `locales/`.
- **Romaji w tekstach piosenek**: katakana w półszerokiej formie (ｱｲｳ, ｶﾞ) oraz rzadkie znaki kana (ヶ, ヵ, ヰ, ヱ, ヴ-warianty, ㇰ…) są teraz transliterowane zamiast pozostawać jako znaki.
- **Biblioteka**: przyciski akcji w wierszu utworu układają się w siatkę 5×2, dzięki czemu żadna ikona nie jest ucięta.

#### Analiza muzyczna (akordy i harmonia)
- **Rozpoznawanie akordów od nowa** (`2.0.0-chroma-hmm`): chromagram z okienkowanego FFT (szczyty widma, interpolacja paraboliczna, automatyczna korekta strojenia, kompresja logarytmiczna, tłumienie basu i alikwotów, mediana na uderzenie), podobieństwo cosinusowe do szablonów (trójdźwięki wygrywają z septymami, dopóki septyma nie jest wyraźnie słyszalna) oraz Viterbi ze znormalizowanymi przejściami — akord zmienia się po 1–2 uderzeniach wyraźnych dowodów, a nie co ~20 uderzeń. Stałe algorytmu są nazwanymi `const`.
- **Karta dla każdego taktu**: każdy segment akordu mieści się w jednym takcie i niesie jego prawdziwy numer; ostatni segment sięga końca audio. Widok akordów dodatkowo dzieli starsze, wielotaktowe wpisy po tempie, a przegląd całego utworu skaluje się do długości utworu.
- **Pamięć podręczna akordów sprawdza wersję analizatora**: wpis ze starszej wersji jest traktowany jak brak i przeliczany automatycznie; zapis zostawia jeden wiersz na utwór, a ręczne poprawki trafiają do najnowszego wiersza i odświeżają jakość akordu.
- **Siatka uderzeń**: okres uderzenia liczony w `f64` (bez dryfu przez zaokrąglanie), faza z histogramu onsetów, wykrywanie pierwszego uderzenia taktu i lokalna korekta fazy każdego taktu; tempo z tagu pliku ma pierwszeństwo.
- **Dekodowanie do analizy akordów**: cały utwór (do 15 min) zamiast 360 s, limit czasu rośnie z długością (`max(6 s, czas/10)`), a przekroczenie limitu jest błędem — niepełny wynik nie trafia już do pamięci podręcznej.

#### Piano-Roll i transkrypcja
- **Kliknięcie w Piano-Rollu przewija we właściwe miejsce**: przeliczanie używa pikseli CSS, a nie rozmiaru bufora canvasu.
- **Wszystkie wykryte nuty są widoczne**: zakres wysokości wynika z danych (wcześniej obcięty do C2–C6, mimo że detekcja obejmuje E1–C7).
- **Znaczniki czasu nut nie dryfują**: krok ramki (46,44 ms) był obcinany do 46 ms, przez co nuty wypadały wcześniej o ok. 1% (~3 s po 5 minutach). Czasy liczone są w `f64`; pamięć podręczna transkrypcji jest wersjonowana (`1.2.0-salience-f64`), więc stare wyniki zostaną przeliczone, a zapis zostawia jeden wiersz na utwór.
- **Eksport MIDI** zapisuje plik przez systemowe okno zapisu i backend (walidacja ścieżki i rozszerzenia `.mid`); błędy i potwierdzenie trafiają do powiadomień zamiast `alert()`. Komunikat ładowania Piano-Rolla jest tłumaczony (był zapisany na sztywno po polsku), a `ctx.roundRect` ma zapasową ścieżkę dla starszego WebKitGTK.

#### Odtwarzanie i kolejka
- **Otwarcie projektu stemów nie psuje kolejki**: wpis kolejki był podmieniany (inne `id`), a kursor tasowania nie podążał za utworem, więc następny utwór pomijał bieżący i wypadał losowo. `PlaybackQueue::set_active_item` zachowuje wpis i synchronizuje kursor tasowania.
- **Głośność nie wraca do poprzedniej wartości**, gdy zmiana trafiła na moment zajętości silnika (np. ładowanie utworu).
- **Pliki dodane naraz (przeciągnięcie, argumenty startowe) dostają unikalne identyfikatory** — wcześniej miały ten sam, co psuło MPRIS, pomijanie ciszy i usuwanie z kolejki.
- **Błędy odtwarzania (GStreamer) są pokazywane w interfejsie** jako komunikat zamiast cichego zatrzymania.
- **Zdarzenia silnika (koniec utworu, zapętlenie, tagi radia) obsługuje wyłącznie ticker odtwarzania** — komendy DSP nie przełączają już utworu równolegle z nim.
- **Bardzo wolne tempo (np. 0.25×) nie zwiększa opóźnienia w nieskończoność**, a przełączenie silnika DSP w trakcie odtwarzania nie gubi bufora dźwięku.
- **Tytuły albumów** z literami jak „İ” nie powodują awarii, a słowa „Ghost” / „Lost” nie tracą fragmentu „ost” przy wyszukiwaniu okładek.
- **Utwory przechodzą dalej także przy ukrytym lub zminimalizowanym oknie.** Koniec utworu, przejście do następnego i zapętlenie były obsługiwane tylko wtedy, gdy interfejs odpytywał stan. Obsługuje je teraz osobny wątek backendu (`setup/playback_ticker.rs`), który też aktualizuje MPRIS po automatycznej zmianie utworu.
- **Pomijanie ciszy (Silence Trimming) wreszcie działa.** Element `cutter` nigdy nie był podłączony do potoku (i wymusiłby dźwięk 16-bitowy). Cisza na początku i końcu jest teraz wykrywana w tle, zapamiętywana w bazie i pomijana — z zachowaniem powtarzania, „stop po bieżącym” i crossfade. Koniec utworu nie jest ucinany, jeśli analiza nie objęła całego pliku.
- **Losowe odtwarzanie całej biblioteki (Shuffle All) znów działa** — frontend wywoływał nieistniejącą komendę `set_shuffle`. Kolejność losowa zmienia się też między kolejkami.
- **Pierwszy utwór z biblioteki zastępuje utwór demonstracyjny** po pierwszym skanowaniu (brakowało komendy `set_active_track`).
- **Wyłącznik czasowy (Sleep Timer) odlicza podczas odtwarzania** (wcześniej odliczanie restartowało się ~10× na sekundę).
- **Pętla A-B jest dokładniejsza** i nie wysyła wielokrotnych żądań przewinięcia.
- **Akcje z zasobnika systemowego** (odtwórz/pauza/następny/poprzedni) aktualizują MPRIS i Discord, zapisują kolejkę i od razu odświeżają interfejs.
- **Klawisze multimedialne (MPRIS) i gniazdo sterowania nie blokują wątków asynchronicznych** — przełączanie utworów z mikro-wyciszeniem działa w puli wątków blokujących.
- **Usunięto możliwe zakleszczenie silnika** przy jednoczesnym `play()` i `play_index()` (np. klawisz multimedialny i kliknięcie w kolejce).
- **Stan kolejki nie ginie**: zapisy są łączone i wykonywane przez jeden wątek (równoległe zapisy mogły nadpisać nowszy stan starszym), a przy wyjściu z aplikacji końcowy stan jest zapisywany od razu.
- **Plik upuszczony na okno jest dodawany raz** (zdarzenia z kilku kanałów są deduplikowane); elementy z upuszczonych plików pokazują tytuł albumu zamiast wykonawcy albumu.
- **Płynne wyciszanie przy przewijaniu** działa we wszystkich widokach: dok, odtwarzacz, tryb pełnoekranowy, Mini Player, nakładka tekstu, falogram i oś akordów.
- **Suwaki czasu i głośności nie „cofają się” w trakcie przeciągania** (stan z backendu nie nadpisuje gestu użytkownika).

#### Dźwięk i DSP
- **Prawdziwy tryb bit-perfect dla wyłączonych korektorów** — wyłączony EQ graficzny i parametryczny przepuszcza próbki bez przetwarzania; przycisk EQ nie pokazuje już fałszywie stanu „włączony”.
- **Crossfeed w DSP Studio działa** (suwaki i przełącznik nie były podłączone do ustawień).
- **ReplayGain w trybie Auto** zaczyna od Track Gain zamiast dziedziczyć tryb Album.
- **Wizualizacja widma nie powoduje już awarii** dla analizatora zwracającego od 16 do 63 pasm.
- **Ścieżki ze spacjami i znakami spoza ASCII** (np. japońskie tytuły) działają w stemach, separacji i analizie (poprawne kodowanie URI).
- **Analiza nie zawiesza się na uszkodzonych plikach**: dekodowanie do analizy (tonacja/BPM, akordy, transkrypcja, cisza, stemy, falogram) kończy się błędem, gdy dekoder zgłosi problem (uszkodzony plik, brak kodeka), zamiast blokować wątek na zawsze.
- **Falogram obejmuje cały utwór**: wcześniej dekodowanie było przerywane po 12 s lub 20 mln próbek (~30 min), więc długie miksy miały ucięty przebieg.
- **Separacja stemów (HPSS) zużywa wielokrotnie mniej pamięci**: zamiast 16 pełnych macierzy spektrogramu (ok. 1,7 GB dla 5-minutowego utworu) widmo jest liczone w buforze 15 ramek; wynik jest identyczny bit w bit.
- **Analiza akordów i transkrypcja z pamięci podręcznej** zwracają zapisane tempo, tonację i kod Camelot zamiast stałych `120 BPM` / „Detected”; eksport MIDI używa rzeczywistego tempa.

#### Biblioteka i dane
- **Migracja bardzo starych baz (sprzed v1)** nie kończy się błędem „no such column”; każdy krok migracji jest jedną transakcją, a błąd nie oznacza bazy jako zmigrowanej.
- **Ustawienia wydajności SQLite (cache 64 MB, mmap) obowiązują na każdym połączeniu**, nie tylko na jednym z pięciu; ścieżki bazy z `?`, `#` czy `%` działają poprawnie.
- **Brak połowicznych plików**: stemy WAV, eksporty (transkoder) i archiwa ZIP projektów powstają w pliku tymczasowym i zastępują cel dopiero po sukcesie; eksport ZIP nie dopisuje do starego archiwum; długi eksport nie jest przerywany po 180 s (limit dotyczy tylko zastoju).
- **Separacja stemów nie zapisuje w cache obciętego wyniku** po przekroczeniu czasu dekodowania.
- **Usunięcie utworu „z plikiem”** zgłasza błąd, gdy pliku nie udało się usunąć, zamiast zostawiać go na dysku.
- **Projekty stemów** tworzone i usuwane atomowo (nigdy projekt bez kanałów).
- **Pobieranie modeli**: anulowanie działa także przy zawieszonym połączeniu, równoległe pobierania nie dzielą pliku tymczasowego ani identyfikatora.
- **Lista kart dźwiękowych działa przy polskim (i każdym innym) języku systemu.**
- **Skaner zapisuje prawdziwego wykonawcę albumu** (tag `ALBUMARTIST`), więc kompilacje nie rozpadają się na osobne albumy; istniejące rekordy naprawia migracja bazy.
- **Pliki usunięte z dysku znikają z biblioteki po ponownym skanowaniu** — tylko w obrębie skanowanego folderu i tylko po kompletnym przejściu (odmontowany dysk nie wyczyści biblioteki).
- **Usuwanie utworu z zapisaną zakładką** nie kończy się błędem klucza obcego.
- **Playlisty pokazują ulubione, oceny, BPM i ReplayGain** (te kolumny były pomijane).
- **Spójne zapisy w bazie**: równoległe dodawanie do playlisty nie dubluje pozycji; przełączanie ulubionych, historia odsłuchów i kanały projektu stemów zapisują się w całości albo wcale.
- **Statystyki czasu słuchania (Recap)** liczy backend — także przy ukrytym oknie; uśpienie systemu nie dolicza godzin.
- **Przerwane separacje stemów** są przy starcie oznaczane jako nieudane zamiast wisieć w stanie „separating”.
- **Przerwane pobieranie** nie zostawia plików tymczasowych `.auralune_tmp_*`.
- **Bezpieczna zmiana nazw plików**: wzorce nie mogą tworzyć ścieżek absolutnych ani wychodzić poza katalog (`..`), długość nazw jest ograniczona, a istniejące pliki są nadpisywane tylko po potwierdzeniu.
- **Tabela utworów**: kolumna `#` pokazuje numer pozycji w widoku (numer ścieżki z tagów jest w podpowiedzi), a ponowne kliknięcie nagłówka odwraca kolejność domyślną.

#### Interfejs i ustawienia
- **Przeprojektowana oś „Harmonia i akordy”** (Studio analizy muzyki): akordy ułożone w siatkę taktów zamiast długiego paska, powtórzenia scalone, pasek przeglądu całego utworu (klik = przewinięcie), kolory rodzin akordów z legendą, podgląd następnego akordu, wyciszone takty już zagrane, postęp w bieżącym akordzie, niska pewność oznaczona kropkowaną krawędzią, edycja akordu po najechaniu. Autoprzewijanie pauzuje po ręcznym przewinięciu.
- **Asystent kolejki harmonicznej jest w pełni przetłumaczony**: etykiety dopasowania („Kontrastujący klucz”, „Dopasowanie harmoniczne”, half/double-time…), „MATCH”, „Off”, „Klucz ?/BPM ?”, podpowiedź synchronizacji tempa i „Smart Shuffle” (Infinity Queue) oraz „Takt N” na osi akordów w Studiu analizy muzyki korzystają teraz z tłumaczeń (en/pl/de/fi/la).
- **`auralune --uninstall`** (oraz `auralune-dev --uninstall`): zainstalowany launcher potrafi sam odinstalować aplikację (AppImage, wpis w menu, ikony); biblioteka i ustawienia pozostają.
- **Efekty Ambience są ostre**: canvas był rysowany w połowie rozdzielczości i rozciągany (piksele, artefakty); teraz bufor odpowiada rozdzielczości ekranu (HiDPI), a proporcje nie są już zniekształcane przez minimalny rozmiar 320×240.
- **Statystyki → „Ostatnio odtwarzane”**: czas „temu” pokazuje teraz liczbę (np. „5 min temu”, „3 godz. temu”) — wcześniej tłumaczenia nie miały znacznika liczby, więc wyświetlało się samo „min temu”. Wspólny formatter `formatRelativeTime` w `utils/timeFormat.ts`.
- **Ustawienie powiadomień systemowych jest zapamiętywane** — przełącznik zapisywał wartość pod innym kluczem niż odczytywany przy starcie; zapisana wcześniej wartość jest przenoszona.
- **„Dodaj do kolejki” i „Odtwórz jako następny”** w tabeli utworów i widoku albumu działają.
- **Skan ReplayGain pojedynczego utworu** z biblioteki działa.
- **Przełącznik „Przywracaj sesję przy starcie”** w Ustawieniach → Urządzenia działa.
- **Zakładka statystyk** znów się otwiera (brakowało jej w routerze widoków).
- **Skróty klawiaturowe** używają aktualnego języka, jednostki głośności i obsługi akcji (wcześniej wartości z pierwszego renderu).
- **Okna dialogowe nie wymuszają już języka polskiego** niezależnie od ustawień.
- **Pełna lokalizacja interfejsu w 5 językach** (en, pl, de, fi, la) — usunięto twardo zakodowane napisy m.in. z inspektora toru audio, centrum pobierania, magnetofonu i gramofonu, kolejki, biblioteki, radia, generatora dźwięków tła, miksera stemów i DSP Studio; test pilnuje zgodności kluczy.
- **Brak wycieków nasłuchów zdarzeń** przy szybkim zamykaniu okien (`useTauriEvent`).

#### Bezpieczeństwo
- **Ścisła polityka CSP okna aplikacji** (wcześniej wyłączona) — bez skryptów inline i `eval`.
- **Kontrola ścieżek wskazanych w interfejsie**: zapis (eksporty, renderowanie, pobieranie, kopie zapasowe) jest odrzucany dla katalogów systemowych i ukrytych folderów w katalogu domowym; odczyt okładek, tapet, kopii i playlist sprawdza rozszerzenie po rozwiązaniu dowiązań.
- **Bezpieczniejsze okładki**: limit 20 MB, wymagany typ obrazu, tylko adresy http(s), bezpieczne nazwy plików.
- **Kolejka FIFO i gniazdo sterowania** są dostępne tylko dla bieżącego użytkownika; ikona aplikacji nie jest wczytywana z `/tmp`; serwer deweloperski Vite nasłuchuje tylko na `127.0.0.1`.
- **Pliki IPC w prywatnym katalogu**: status Waybara, kolejka FIFO i gniazdo sterowania przeniesiono z `/tmp` do `$XDG_RUNTIME_DIR/auralune/` (katalog `0700`). **Konfigurację Waybara trzeba wskazać na `$XDG_RUNTIME_DIR/auralune/auralune.json`**, a skrypty — na `$XDG_RUNTIME_DIR/auralune/ctl` / `auralune.sock`. Gniazdo Discorda w `/tmp` jest używane tylko, gdy należy do bieżącego użytkownika. Polecenia IPC mają limit długości i liczby połączeń, a zamknięcie aplikacji rzeczywiście zatrzymuje nasłuch.
- **Ochrona bazy biblioteki**: eksporty nie mogą nadpisać `auralune_library.db`; wszystkie komendy zapisują i czytają przez ścieżkę po rozwiązaniu dowiązań (bez wyścigu z podmianą dowiązania).
- **Nowe kontrole ścieżek**: zapis pliku `.lrc` tylko obok istniejącego pliku audio, edytor tagów zapisuje wyłącznie do pliku przypisanego do utworu w bibliotece, okładki z folderu utworu muszą być obrazami (dowiązanie `cover.jpg` → klucz SSH nie zostanie odczytane), wejście transkodera musi być plikiem audio.
- **Pobieranie okładek z adresu URL**: tylko `https` i wyłącznie publiczne hosty (bez `localhost`, sieci LAN i przekierowań do nich); limit 20 MB działa także bez nagłówka `Content-Length`.
- **Argumenty programów zewnętrznych**: `pactl`, `fpcalc`, `kdialog` i `yt-dlp` nie zinterpretują już wartości z interfejsu jako opcji; `yt-dlp` ma limit czasu i jest zabijany przy anulowaniu, a `%` w nazwie folderu nie psuje szablonu.
- **MPRIS `OpenUri`** przyjmuje tylko strumienie http(s) i istniejące lokalne pliki audio; okładki przekazywane do MPRIS muszą być obrazami.
- **CSP**: usunięto nieużywany protokół `asset:`; import kopii profilu sprawdza poprawność motywów.

#### Budowanie i CI
- **Usługi sieciowe odporne na chwilowe awarie**: zapytania do MusicBrainz i AcoustID są ponawiane (do 3 prób z narastającym odstępem) przy błędach sieci i odpowiedziach 429/502/503/504; AcoustID ma limit 3 zapytań na sekundę; zawieszony `fpcalc` jest przerywany po 60 s; wszystkie usługi wysyłają jeden User-Agent z aktualną wersją (wcześniej m.in. na sztywno `0.1.0`), a teksty piosenek korzystają z jednego klienta HTTP zamiast tworzyć nowy dla każdego utworu.
- **CI**: sprawdzanie składni skryptów powłoki (`bash -n`), informacyjny audyt zależności `cargo-deny` (podatności, licencje, duplikaty), test dymny uruchamiany raz zamiast dwa razy, uprawnienia pamięci podręcznej apt ograniczone do odczytu zamiast `777`.
- **Usunięto 11 nieużywanych zależności** z crate'ów (m.in. `libc` i `thiserror` w modułach DSP, `storage` w `downloads` i `metadata`).
- **Paczki Linuksa** budowane jako `appimage` i `deb` (błąd RPM dla wersji `1.1.6-dev` na systemach z `rpmbuild`).
- **CI**: brakujące zależności zasobnika systemowego, błąd uprawnień przy zapisie pamięci podręcznej apt, kolizja tagu `dev` przy wypychaniu wydań, instalacja zależności skrócona z ~12 do 1–2 minut.
- **Instalator** nie pobiera przypadkowo wersji testowych z kanału stabilnego ani po cichu przestarzałych wersji stabilnych z kanału deweloperskiego.

---

### 🔄 Zmieniono (Changed)

#### Wydajność
- **Studio analizy muzyki nie renderuje się przy każdym ticku odtwarzania**: modal nie czyta już pozycji na żywo, a lista zakładek jest zapamiętana; pozycję czytają tylko karty, które jej potrzebują (oś akordów i Piano-Roll).
- **Odtwarzanie, przewijanie, przełączanie utworów, zmiany DSP i polecenia `pactl` nie blokują już głównego wątku okna** (wcześniej mikro-wyciszenia i dekodowanie zamrażały interfejs na 30–150 ms).
- **Wykrywanie ciszy działa strumieniowo** (stała pamięć zamiast do ~635 MB dla 2-godzinnego pliku) i jest anulowane przy zmianie utworu lub progu.
- **Skanowanie biblioteki**: jedno zapytanie o wszystkie znane pliki zamiast osobnego dla każdego pliku; lista projektów stemów jednym zapytaniem.
- **Analiza ReplayGain, okładki albumów, ikony systemowe, PipeWire i wyszukiwanie gniazda Discorda** nie blokują wątków asynchronicznych.
- **Interfejs nie renderuje się w całości 10× na sekundę podczas odtwarzania**: stan przychodzi zdarzeniem `auralune://playback-status` (backend wysyła go co 100 ms przy odtwarzaniu i co 250 ms w spoczynku; frontend nie odpytuje). Pozycja i widmo trafiają do lekkiego magazynu `src/state/livePlayback.ts`, więc w każdej klatce odświeżają się tylko paski postępu i wizualizacje.
- **Szybszy start**:
  - ustawienia wczytywane jednym zapytaniem, bez trzykrotnego ładowania całej biblioteki;
  - ikony systemowe aktualizowane w tle;
  - zamknięcie okna nie odpytuje bazy;
  - 30 okien dialogowych ładowanych na żądanie (`React.lazy`);
  - podział paczek Vite zmniejszył główny plik JavaScript z ~1,57 MB do ~465 kB (110 kB gzip).
- **Skanowanie biblioteki, liczenie SHA-256 projektu stemów i rozwijanie upuszczonych folderów** nie blokują wątków asynchronicznych.
- **Baza SQLite**: większa pamięć podręczna (64 MB), tabele tymczasowe w RAM, `mmap`, nowe indeksy; wyszukiwanie duplikatów jednym zapytaniem.
- **Silnik audio bezpieczniejszy w czasie rzeczywistym**:
  - tryb Bypass działa bez blokad;
  - zmiana formatu lub rozmiaru bloku nie wstrzymuje strumienia;
  - efekty czytają ustawienia bez blokad;
  - przy buforach nie ma alokacji pamięci;
  - próbki są odczytywane ze sprawdzeniem wyrównania pamięci.

  Mniejsze ryzyko trzasków przy zmianie parametrów.
- **Wyszukiwanie i sortowanie w bibliotece**: `useDeferredValue` (pisanie nie zacina interfejsu) i 2–3× szybsze sortowanie (`Intl.Collator`, z polskimi regułami).
- **Wizualizacje zatrzymują się**, gdy okno jest ukryte lub zminimalizowane.
- **Mniej przerysowań**: kluczowe komponenty i sekcje odtwarzacza niezależne od pozycji są memoizowane (`React.memo`).

#### Architektura backendu
- **Moduły zamiast monolitów**:
  - `lib.rs` aplikacji desktopowej: z 4914 do ~300 linii (komendy w `commands/`, start, zasobnik, ticker i zamykanie w `setup/`);
  - `crates/storage`: z ponad 3000 linii do 9 podmodułów;
  - `pipeline.rs` silnika audio (3089 linii): moduły tematyczne `pipeline/` bez zduplikowanego kodu źródeł, stemów, przejść i obsługi końca utworu;
  - `analysis.rs` (2066 linii): moduły `analysis/` (dekodowanie, tonacja/BPM, akordy, transkrypcja, ReplayGain, falogram, cisza) z jednym wspólnym dekoderem zamiast czterech kopii.
- **Typowane błędy**: każda komenda Tauri zwraca `{ code, message }` (`storage`, `engine`, `io`, `not_found`, `validation`, `network`, `internal`); crate'y mają własne typy błędów (`AnalysisError`, `TagError`, `ScrobbleError`, `DomainError` i inne). Panika jednego wątku nie unieruchamia już silnika (`lock_safe`).
- **Porządne zamykanie aplikacji**: zapis kolejki, zatrzymanie silnika i sterowania IPC, usunięcie pliku statusu Waybar.
- **Usunięto 31 nieużywanych komend IPC** (m.in. aliasy `set_*_ratio` / `set_pitch_semitones`, nieużywane gettery i eksporty) oraz `notify_track_looped` — zostało 183 komend; logika w silniku i bazie pozostaje. Wspólne mapowanie nazw silnika DSP (`DspEngine::from_name` / `as_str`) i jedno wyszukiwanie okładek dla Discord zamiast kopii.
- **Testy przeniesione z plików produkcyjnych** (`#[cfg(test)]`) do katalogów `tests/` we wszystkich crate'ach.

#### Architektura frontendu
- **`App.tsx` z ponad 3700 do ~1300 linii**: logika w hookach domenowych (`usePlaybackController`, `usePlaybackQueue`, `useLibraryManager`, `useDspManager`, `useModalManager`, `useAudioSettings`, `usePlaylistManager`, `useScrobblerManager` i inne), ekrany w `views/`, właściwości składane przez hooki-budowniczych. Nieużywane hooki `useAudioPlayer`, `useThemeEngine` i `useMainContentRouterProps` usunięto.
- **Duże widoki podzielone na sekcje**: `PlayerView` (3032 → 419 linii), `LibraryView` (2950 → 259), `DspStudioView` (2167 → 360) oraz tryb pełnoekranowy, ustawienia urządzeń i transkodowania, korektor parametryczny, import z URL i studio stemów.
- **Słowniki tłumaczeń w plikach JSON** (`src/locales/`) zamiast pliku `i18n.ts` z ponad 4800 liniami; wspólna funkcja `fmt` dla szablonów (zamiast 157 łańcuchów `.replace('{0}', …)`).
- **Typowana warstwa IPC** (`src/api/`): `invoke` przyjmuje tylko zarejestrowane komendy (lista generowana z backendu, `npm run gen:commands`), błędy mają kod (`IpcError`), ustawienia mają zamkniętą listę kluczy.
- **Ścisły TypeScript** (`strict`), usunięto ~390 z ~434 użyć `any`, każdy typ kontraktu z backendem ma jedną definicję; reguła `exhaustive-deps` jest błędem lintera. Poprawiono zależności hooków i czystość renderowania zgłaszane przez reguły React 19.
- **Wspólne narzędzia**: kolejka komunikatów `useToasts`, trwałe ustawienia `usePersistedState`, wspólne formatowanie rozmiarów i czasu, wspólny mock IPC w testach.

#### Środowisko
- **Node.js 22 LTS** oraz stabilny Rust (edycja 2021) z `rustfmt` i `clippy`.
