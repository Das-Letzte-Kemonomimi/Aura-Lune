# ADR 0003: Schemat bazy danych SQLite, przyrostowy skaner biblioteki i hierarchia okładek

- **Status**: Zaakceptowany
- **Data**: 2026-10-17
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**: Aplikacja wymaga lokalnej biblioteki muzycznej (Artists, Albums, Tracks) o wysokiej wydajności, odpornej na duże kolekcje (dziesiątki tysięcy plików), ze skanowaniem przyrostowym, ekstrakcją metadanych i pobieraniem lokalnych grafik albumów.

---

## 1. Silnik bazy danych i migracje (SQLite + sqlx)

### Decyzja
- Użycie wbudowanej bazy **SQLite** za pośrednictwem biblioteki `sqlx` (asynchroniczny pool połączeń `SqlitePool`).
- Schemat bazy relacyjnej z indeksami:
  - `tracks`: identyfikator, ścieżka bezwzględna, tytuł, wykonawca, wykonawca albumu, klucz obcy do `albums`, numer dysku/ścieżki, długość trwania w ms, format, częstotliwość próbkowania, kanały, głębia bitowa, rozmiar pliku i czas modyfikacji (mtime).
  - `albums`: identyfikator, tytuł, wykonawca albumu, rok wydania, ścieżka do okładki w cache lub na dysku.
  - `artists`: identyfikator, nazwa.
  - `playback_bookmarks`: zapamiętywanie pozycji per utwór dla wznawiania odtwarzania.
  - `dsp_presets`: presety DSP (globalne, per album lub per utwór).
- Indeksy na polach: `tracks(path)` (unikalny), `tracks(album_id)`, `tracks(artist)`, `albums(title, album_artist)`.

---

## 2. Przyrostowe skanowanie biblioteki (Incremental Scanning)

### Problem
Odczyt pełnych nagłówków i tagów ID3/Vorbis dla tysięcy plików przy każdym uruchomieniu blokowałby I/O i procesor.

### Decyzja
- Skaner sprawdza metadane systemu plików: `path`, `file_size` i `mtime` (czas ostatniej modyfikacji).
- Jeśli plik o danej ścieżce istnieje w bazie i jego `mtime` oraz `file_size` są identyczne — plik jest natychmiast pomijany (czas weryfikacji rzędu mikrosekund).
- Tylko nowe lub zmodyfikowane pliki podlegają pełnemu parsowaniu tagów przez bibliotekę `lofty`.
- Pliki usunięte z dysku są wykrywane i usuwane z indeksu biblioteki.

---

## 3. Ekstrakcja metadanych i hierarchia okładek

### Decyzja
1. Do odczytu tagów (FLAC, MP3, OGG, Opus, WAV, M4A) wykorzystujemy czysto rustową bibliotekę `lofty`.
2. **Priorytet okładek lokalnych**:
   - **Krok 1**: Sprawdzenie osadzonej grafiki (embedded picture / APIC / METADATA_BLOCK_PICTURE) w pliku audio. Jeśli istnieje, jest zapisywana do katalogu cache aplikacji (`~/.cache/auralune/covers/<hash>.jpg`).
   - **Krok 2**: Poszukiwanie plików graficznych w tym samym katalogu co utwór: `cover.jpg`, `cover.png`, `folder.jpg`, `folder.png`, `front.jpg`.
   - **Krok 3**: W przypadku braku grafiki lokalnej — oznaczenie braku okładki (placeholder / gotowość do pobrania z Cover Art Archive w Etapie 4).
