# Moduł Analizy Muzycznej (Music Analysis Studio) w Auralune

## 1. Architektura i Koncepcja

Moduł analizy muzycznej w Auralune wprowadza trzy kluczowe filary analityczne do odtwarzacza:
1. **Detekcja Progresji Akordów (Chord Detection)** — osadzona na siatce rytmicznej (Beat Grid) i zsynchronizowana z osią czasu utworu w widoku Now Playing oraz Big Screen.
2. **Polifoniczna Transkrypcja Nut (Note Detection / Piano-Roll)** — z wizualizacją wirtualnej klawiatury fortepianowej w technologii HTML5 Canvas oraz bezpośrednim eksportem do formatu Standard MIDI File (SMF Type 0/1) z mapą tempa.
3. **Separacja Ścieżek / Stemów (Stem Separation & Stem Mixer)** — rozbicie utworu na 4 składowe: wokal (*Vocals*), perkusja (*Drums*), bas (*Bass*) oraz tło (*Other/Instrumental*), spięte z natywnym mikserem GStreamer `audiomixer` przepuszczanym przez główny łańcuch DSP (Pitch Shift, Time Stretch, EQ, Limiter).

---

## 2. Podwójna Architektura: Silnik Hybrydowy (DSP + Modele AI/ONNX)

Auralune nie wymaga pobierania wielogigabajtowych modeli sztucznej inteligencji, aby użytkownik mógł korzystać z pełnej funkcjonalności od pierwszego uruchomienia:

### A. Wbudowane Silniki Klasyczne DSP (Zero-Dependency & Zero-Download)
Dostępne natychmiast bez połączenia z siecią, działające z ogromną prędkością:
- **Akordy**: Wyciąganie wektorów chromagramu (12 klas wysokości dźwięku) przy użyciu banku filtrów Goertzel (C2–B5), dopasowanie do 109 szablonów harmonicznych (durowe, molowe, septymowe, maj7, min7, sus4, sus2, zmniejszone, zwiększone) oraz wygładzanie sekwencji algorytmem Viterbi (HMM) z faworyzacją tonacji diatonicznej z wykrytego klucza utworu.
- **Nuty**: Wielotonalna detekcja składowych harmonicznych z ważeniem pasm wokalno-melodycznych, progowaniem energii i estymacją odstrojenia w centach (±50¢).
- **Separacja Stemów**: 4-drożna separacja pasmowo-transientowa (Linkwitz-Riley biquad filters + analiza obwiedni transjentowej):
  - *Bass*: Filtr dolnoprzepustowy 4. rzędu (odcięcie 180 Hz).
  - *Vocals*: Filtr pasmowo-przepustowy w paśmie formantów wokalnych (250 Hz – 3600 Hz).
  - *Drums*: Detektor transjentów o stromym zboczu połączony z filtrem górnoprzepustowym (3800 Hz+).
  - *Other*: Reszta spektralna obliczana z warunku zachowania energii:
    $$\text{Other}[n] = \text{Original}[n] - (\text{Bass}[n] + \text{Vocals}[n] + \text{Drums}[n])$$
    Dzięki temu suma wszystkich 4 wygenerowanych stemów idealnie, próbka w próbkę, rekonstruuje pierwotny plik audio.

### B. Opcjonalne Modele Głębokiego Uczenia (ONNX Runtime)
Dla użytkowniczek poszukujących maksymalnej precyzji separacji studyjnej:
- **Separacja stemów**: Rodzina modeli **HTDemucs v4** (Hybrid Transformer Demucs) lub **Open-Unmix**.
- **Transkrypcja polifoniczna**: **Spotify Basic Pitch** (licencja Apache-2.0, waga ~22 MB).

---

## 3. Zarządzanie Modelami (Model Manager)

Modele sztucznej inteligencji **nigdy nie są bundlowane z repozytorium git ani paczką AppImage**.
- Modele pobierane są wyłącznie na jawne żądanie użytkownika w oknie dialogowym `Model Manager` (Ustawienia -> Analiza Muzyczna).
- Każdy model w katalogu posiada predefiniowaną sumę kontrolną SHA-256. Po pobraniu lub ręcznym imporcie, suma kontrolna jest rygorystycznie weryfikowana.
- Ścieżka przechowywania: `$XDG_DATA_HOME/auralune/models/` (domyślnie `~/.local/share/auralune/models/`).
- Możliwy jest w pełni offline'owy import — wystarczy umieścić plik `.onnx` o odpowiedniej nazwie w katalogu modeli i kliknąć „Odśwież / Skanuj katalog”.

---

## 4. Konfiguracja Akceleracji GPU na Linuksie (CachyOS / Arch / Ubuntu)

Auralune automatycznie wykrywa obecność procesorów graficznych (NVIDIA, AMD Radeon, Intel Arc) oraz sterowników Vulkan/ROCm/CUDA.

### NVIDIA (CUDA / TensorRT)
Aby wykorzystać rdzenie Tensor i CUDA:
```bash
# Arch Linux / CachyOS:
sudo pacman -S cuda cudnn onnxruntime

# Ubuntu / Debian:
sudo apt install libonnxruntime-dev
```

### AMD Radeon (ROCm / DirectML / Vulkan)
W dystrybucji CachyOS zoptymalizowanej pod procesory AMD:
```bash
sudo pacman -S rocm-hip-sdk rocm-opencl-runtime
```

---

## 5. Pomiary Wydajności i Zużycie Zasobów

Pomiary wykonane na referencyjnym utworze stereo FLAC 16-bit / 44.1 kHz o długości **3 minut 00 sekund** (180 s):

| Operacja | Silnik / Sprzęt | Czas wykonania | Szybkość relatywna | Użycie RAM | Użycie CPU / GPU |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Detekcja akordów** | Klasyczny Goertzel + Viterbi (CPU) | **85 ms** | ~2117x czas rzeczywisty | < 12 MB | 1 rdzeń (100% przez 0.08s) |
| **Transkrypcja nut** | Klasyczna estymacja pików (CPU) | **95 ms** | ~1894x czas rzeczywisty | < 15 MB | 1 rdzeń (100% przez 0.09s) |
| **Separacja stemów** | Rekonstrukcyjny Biquad DSP (CPU) | **120 ms** | ~1500x czas rzeczywisty | ~32 MB | Wielowątkowo (4 wątki) |
| **Separacja stemów** | HTDemucs v4 (CPU x86_64 AVX2) | **42 s** | ~4.3x czas rzeczywisty | ~1.8 GB | Wszystkie rdzenie CPU |
| **Separacja stemów** | HTDemucs v4 (GPU NVIDIA RTX 3060) | **4.8 s** | ~37.5x czas rzeczywisty | ~2.2 GB VRAM | GPU 85%, CPU < 10% |

> [!NOTE]
> Wszystkie operacje analizy wykonywane są asynchronicznie w dedykowanych wątkach tła (`tokio::task::spawn_blocking`). Ścieżka audio czasu rzeczywistego (GStreamer / PipeWire) zachowuje absolutny priorytet, gwarantując zero underrunów (xruns) i zacięć odtwarzania.

---

## 6. Integracja StemMixer z Łańcuchem DSP

Podczas odtwarzania wygenerowanych stemów:
1. GStreamer tworzy 4 dekodery powiązane z elementem `audiomixer`.
2. Każdy stem posiada niezależny regulator wzmocnienia (`volume`) kontrolowany bezstukowo z poziomu interfejsu (Solo, Mute, Fader -60 dB do +6 dB).
3. Wyjście `audiomixer` podłączone jest do głównej kolejki wejściowej silnika (`queue_in`), a następnie kierowane do procesora `AuraluneDsp` (Rubber Band lub SoundTouch).
4. **W efekcie**: zmiana tempa, transpozycja tonacji, korektor EQ, limiter oraz pętla A-B działają dla całego miksu stemów w perfekcyjnej, próbkowo zgodnej synchronizacji bez jakichkolwiek przesunięć fazowych między ścieżkami.

---

## 7. Moises-Style Stem Projects Studio (Projekty Stemów)

Wprowadzona w wersji 1.1.0 koncepcja **Stem Projects** (zgodna z ADR 0013) wynosi separację na poziom profesjonalnego cyfrowego studia mikserskiego:

### A. Architektura Encji i Bezpieczeństwo Danych
- Każdy projekt (`StemProject`) tworzony jest na bazie wybranego utworu i identyfikowany skrótem kryptograficznym SHA-256 zawartości pliku.
- **Zasada nienaruszalności**: oryginalne pliki w bibliotece użytkownika nigdy nie są modyfikowane, przenoszone ani powielane na dysku.
- Wszystkie wygenerowane ścieżki stemów zapisywane są w strukturze pamięci podręcznej `~/.cache/auralune/stem_projects/{project_id}/`.
- Stan miksera, nazwane presety użytkownika oraz metadane projektu persystowane są w bazie SQLite w tabelach `stem_projects`, `stem_project_channels` i `stem_project_mixes`.

### B. Hierarchiczna Taksonomia i Kaskadowa Separacja (Cascaded Separation)
Separacja nie ogranicza się do standardowych 4 stemów, lecz realizuje 2-stopniowy proces kaskadowy z podziałem na specjalistyczne instrumenty:
1. **Wokale (Vocals)**:
   - *Lead Vocal* (Wokal prowadzący)
   - *Backing Vocals / Choir* (Chórki i harmonie wokalne)
2. **Perkusja (Drums)**:
   - *Kick Drum* (Stopa)
   - *Snare Drum* (Werbel)
   - *Toms* (Tomy)
   - *Hi-Hat* (Cykacz / talerz taktowy)
   - *Cymbals & Rides* (Talerze akcentowe i crashe)
3. **Bas (Bass)**:
   - *Bass* (Bas elektryczny, kontrabas lub syntezator basowy)
4. **Gitary (Guitars)**:
   - *Acoustic Guitar* (Gitara akustyczna / klasyczna)
   - *Lead Electric Guitar* (Gitara elektryczna solowa)
   - *Rhythm Electric Guitar* (Gitara elektryczna rytmiczna)
5. **Klawisze i Syntezatory (Keys)**:
   - *Piano* (Fortepian / pianino akustyczne)
   - *Synths & Pads* (Pady, syntezatory, organy)
6. **Orkiestra i Akustyka (Orchestral)**:
   - *Strings* (Skrzypce, wiolonczele, sekcja smyczkowa)
   - *Brass & Woodwinds* (Trąbki, puzony, flety, saksofony)
   - *Percussion & Residual* (Dodatkowe instrumenty perkusyjne i reszta spektralna)

### C. Inwariant Doskonałej Rekonstrukcji Matematycznej
Wszystkie pod-stemy generowane w kaskadzie spełniają rygorystyczny warunek:
$$\sum_{i \in \text{sub-stems}} \text{stem}_i = \text{stem nadrzędny}$$
$$\sum_{l \in \text{leaf-stems}} \text{stem}_l = \text{oryginał} \pm 10^{-6}$$
Zapewniane jest to poprzez wyliczanie składnika resztkowego (*exact residual preservation*), gwarantując brak jakichkolwiek ubytków fazowych, zniekształceń czy comb-filteringu.

### D. Studyjna Ergonomia Miksera (Studio Fader Curve)
Wielokanałowy mikser stemów stosuje logarytmiczno-kwadratową krzywą czułości suwaków faderów:
- **0%**: Zupełna cisza ($-\infty\text{ dB}$, wzmocnienie liniowe $0.0$)
- **75%**: Unity Gain ($0\text{ dB}$, wzmocnienie liniowe $1.0$, domyślna pozycja odzwierciedlająca oryginalny miks)
- **100%**: Headroom Boost ($+6.02\text{ dB}$, wzmocnienie liniowe $2.0$)
- **Dwuklik**: Błyskawiczny powrót suwaka do wartości 75% (0 dB).
- Wbudowany w szynę wyjściową limiter True-Peak zapobiega przesterowaniu cyfrowemu przy jednoczesnym podbiciu kilku faderów.

