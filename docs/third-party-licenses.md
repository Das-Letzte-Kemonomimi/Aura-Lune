# Weryfikacja Licencji i Zależności Trzecich (Third-Party Licenses)

Projekt **Auralune (Kitsune Player)** jest udostępniany na warunkach licencji **GNU General Public License v3.0 or later (GPL-3.0-or-later)**.
Poniższy rejestr dokumentuje licencje kluczowych zależności systemowych, bibliotek oraz modeli sztucznej inteligencji wykorzystywanych przez aplikację, ze szczególnym uwzględnieniem modułu **Music Analysis**.

---

## 1. Silnik Audio i Biblioteki Systemowe

| Komponent / Zależność | Rola w projekcie | Licencja | Zgodność z GPL-3.0 |
| :--- | :--- | :--- | :--- |
| **GStreamer** | Główny framework multimedialny, demuxing, dekodowanie, `audiomixer` | **LGPL-2.1-or-later** | Pełna zgodność (LGPL pozwala na linkowanie z GPL-3.0) |
| **PipeWire** | Serwer dźwięku Linuksa, wyjście audio o niskiej latencji | **MIT** | Pełna zgodność |
| **Rubber Band Library** | Zaawansowany silnik time-stretching & pitch-shifting | **GPL-2.0-or-later** | Pełna zgodność z GPL-3.0 |
| **SoundTouch** | Alternatywny procesor tempo/pitch/rate | **LGPL-2.1-or-later** | Pełna zgodność z GPL-3.0 |
| **SQLite / SQLx** | Lokalna baza danych metadanych, historii i analiz | **Public Domain / MIT / Apache-2.0** | Pełna zgodność |

---

## 2. Modele AI i Zależności Modułu Analizy Muzycznej

| Komponent | Dostawca / Źródło | Licencja Kodu / Modelu | Uwagi dotyczące dystrybucji |
| :--- | :--- | :--- | :--- |
| **Spotify Basic Pitch** | Spotify Audio Intelligence Lab | **Apache-2.0** | Dozwolone komercyjnie i niekomercyjnie; kompatybilne z GPL-3.0. Model nie jest bundlowany w git ani w AppImage; pobierany opcjonalnie przez użytkownika. |
| **HTDemucs v4** | Meta AI Research | **MIT (kod) / CC-BY-NC 4.0 (wagi)** | Użycie wag niekomercyjne w wersji domyślnej. Model nie jest bundlowany w git ani w AppImage. Użytkownik decyduje o jego pobraniu lub korzysta z wbudowanego fallbacku DSP. |
| **Open-Unmix** | Inria / Sony CSL | **MIT** | W pełni otwarta alternatywa dla separacji 4-stemowej o otwartych wagach. |
| **Klasyczny Silnik DSP (Chords, Notes, Stems)** | Auralune Native (autorski kod Rust) | **GPL-3.0-or-later** | Własna implementacja na bazie algorytmów Goertzela, Viterbi HMM oraz filtrów Linkwitz-Riley bez zewnętrznych bibliotek ML. |
| **ONNX Runtime (`ort`)** | Microsoft | **MIT** | Cienki wrapper FFI linkowany dynamicznie do `libonnxruntime.so` w systemie. |

---

## 3. Zasady Dystrybucji Modeli AI
1. Repozytorium git oraz paczki binarne (AUR `auralune-bin`, AppImage) **nie zawierają żadnych wag modeli głębokiego uczenia**.
2. Wagi pobierane są wyłącznie przez wbudowany `Model Manager` na bezpośrednie żądanie użytkownika i zapisywane lokalnie w katalogu XDG danych użytkownika (`~/.local/share/auralune/models/`).
3. Każdy model w katalogu posiada jawnie wskazaną licencję, adres źródłowy oraz sumę kontrolną SHA-256.

