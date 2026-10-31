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
- **Rozbudowany importer audio URL (filtry jakości i bitrate)**:
  - Wybór profilu jakości / bitratu FFmpeg dla formatów stratnych: MP3 (320 kbps CBR Studio, 256 kbps CBR, 192 kbps CBR, V0 VBR ~245 kbps), OPUS (160 kbps Studio Transparent, 128 kbps Standard, 96 kbps Kompakt), M4A/AAC (256 kbps iTunes Plus, 192 kbps, 128 kbps) oraz bit-perfect FLAC bezstratny.
- **Pobieranie całych playlist, albumów i kanałów SoundCloud**:
  - Przełącznik zbiorczego pobierania linków wieloutworowych (`--yes-playlist`) dla SoundCloud (utwory, sety, profile i playlisty), YouTube, Bandcamp itp.
  - Opcjonalny limit liczby pobieranych utworów (Bez limitu, 5, 10, 25, 50, 100).
  - Wybór układu katalogów docelowych w stylu foobar2000 (podfolder playlisty/albumu `[Folder]/[01 - Tytuł]`, hierarchia artysta/album `[Wykonawca]/[Album]/[01 - Tytuł]` lub płaski katalog).
- **Widok przeglądu pobranej playlisty (Multi-track Review)**:
  - Ekran podsumowania z listą wszystkich pobranych utworów, czasami trwania, formatem, przyciskami natychmiastowego odtworzenia wszystkich („Odtwórz wszystkie”), zakolejkowania całości („Dodaj wszystkie do kolejki”) oraz jednostkowymi kontrolkami odtwarzania per utwór.

### 🛠️ Poprawiono (Fixed)
- Obsłużono kod wyjścia 101 w `yt-dlp` (`MaxDownloadsReached`) jako kontrolowany sukces pobierania przy ustawionym limicie `--max-downloads`.
- Zapewniono odporne rekurencyjne wykrywanie nowo pobranych plików w katalogach potomnych oraz automatyczne zbiorcze indeksowanie w SQLite (`scan_paths`).

### 🔄 Zmieniono (Changed)
- Zaktualizowano kontrakt komendy `import_audio_from_url` o parametry `bitrate`, `download_playlist`, `max_items` oraz `folder_structure`.
- `UrlImportResultDto` zwraca teraz pełną listę `items: Vec<ImportedItemDto>` oraz sumaryczną liczbę pobranych utworów `total_downloaded`.

### ⚡ Wydajność i Architektura (Performance & Internal)
- Bezpieczne wywołanie procesu `yt-dlp` wyłącznie przez wektor argumentów procesu systemowego, eliminujące ryzyko podatności shell injection.
