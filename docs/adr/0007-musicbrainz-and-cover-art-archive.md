# ADR 0007: Integracja metadanych MusicBrainz i okładek Cover Art Archive

- **Status**: Zaakceptowany
- **Data**: 2026-10-17
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**: Wymóg MVP: identyfikacja wydań muzycznych przez identyfikatory MBID, pobieranie oficjalnych okładek z Cover Art Archive, prezentowanie kandydatów przy niepewnym dopasowaniu oraz lokalne buforowanie okładek.

---

## 1. Wytyczne i ograniczenia API MusicBrainz

1. **User-Agent**:
   Zgodnie z regulaminem MusicBrainz API, każde zapytanie HTTP musi posiadać identyfikujący nagłówek User-Agent w formacie:
   `Auralune/0.1.0 ( https://github.com/Auralune/Auralune )`.
2. **Ograniczanie zapytań (Rate Limiting)**:
   Oficjalny serwer MusicBrainz dopuszcza maksymalnie 1 zapytanie na sekundę dla niezarejestrowanych klientów. Klient w crate `metadata` wykorzystuje semafor / mechanizm odliczania czasu między żądaniami, aby unikać błędów HTTP 429 (Too Many Requests).
3. **Format odpowiedzi**:
   Komunikacja odbywa się przez REST API zwracające JSON (`fmt=json`).

---

## 2. Dopasowywanie wydań (Release Matching)

Nie dopasowujemy wydań wyłącznie po tytule utworu:
1. Klient odpytuje endpoint:
   `https://musicbrainz.org/ws/2/release/?query=release:{album}%20AND%20artist:{artist}&fmt=json`
2. Zwracana jest lista kandydatów `ReleaseCandidateDto`:
   - `mbid`: identyfikator UUID wydania MusicBrainz,
   - `title`: tytuł albumu,
   - `artist`: wykonawca / album artist,
   - `date`: rok/data wydania,
   - `country`: kraj wydania,
   - `track_count`: liczba utworów,
   - `score`: wskaźnik zgodności Lucene (0-100).
3. Użytkowniczka w interfejsie może przejrzeć kandydatów i potwierdzić właściwe wydanie lub wybrać automatyczne przypisanie dla kandydata z wynikiem 100.

---

## 3. Pobieranie okładek z Cover Art Archive

1. Po uzyskaniu `mbid`, odpytujemy:
   `https://coverartarchive.org/release/{mbid}`
   lub bezpośrednio pobieramy miniaturę front cover:
   `https://coverartarchive.org/release/{mbid}/front-500` (lub `front-250`).
2. Pobieranie zapisuje plik w bezpiecznym katalogu cache aplikacji:
   `~/.local/share/auralune/cache/covers/{mbid}.jpg`.
3. Baza SQLite (`albums`) jest aktualizowana o ścieżkę do pobranej miniatury oraz `release_mbid`.
