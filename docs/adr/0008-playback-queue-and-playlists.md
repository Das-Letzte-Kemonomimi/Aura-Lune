# ADR 0008: Kolejka odtwarzania (Playback Queue) i zarządzanie playlistami

- **Status**: Zaakceptowany
- **Data**: 2026-10-17
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**: Wymóg MVP: pełna obsługa kolejki odtwarzania (`play/pause/stop/next/previous/queue`), trybów zapętlania (`LoopMode`: None, Track, Queue), losowego odtwarzania (`Shuffle`), zarządzania playlistami w bazie SQLite oraz synchronizacji z interfejsem D-Bus MPRIS 2.2.

---

## 1. Architektura kolejki (Domain Model)

1. **Struktura `PlaybackQueue`**:
   - Czysta, bezstanowa logika domenowa w `crates/domain/src/queue.rs`:
     - `items: Vec<QueueItem>` – uporządkowana lista pozycji,
     - `current_index: Option<usize>` – wskaźnik aktywnego utworu,
     - `loop_mode: LoopMode` – `None`, `Track` (zapętlenie jednego utworu), `Queue` (zapętlenie całej kolejki),
     - `shuffle: bool` – losowa kolejność odtwarzania oparta o deterministyczną permutację indeksów `shuffle_order`.
2. **Nawigacja `next` i `previous`**:
   - `next()`:
     - Jeśli `LoopMode::Track`: powtarza bieżący utwór od początku.
     - W trybie `Shuffle`: przechodzi do kolejnego indeksu w `shuffle_order`.
     - W trybie sekwencyjnym: inkrementuje `current_index`. Jeśli osiągnięto koniec i aktywny jest `LoopMode::Queue`, powraca na początek kolejki (indeks 0).
   - `previous()`:
     - Wycofuje do poprzedniego utworu lub (jeśli odtwarzanie trwało > 3 sekundy) resetuje pozycję bieżącego utworu.

---

## 2. Baza danych SQLite (Playlisty i kolejka)

1. Tabela `playlists`:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`,
   - `name TEXT NOT NULL UNIQUE`,
   - `created_at INTEGER NOT NULL`.
2. Tabela `playlist_tracks`:
   - Relacja N:M z zachowaniem kolejności (`position INTEGER`).
   - Kaskadowe usuwanie przy usunięciu playlisty (`ON DELETE CASCADE`).
3. Tabela `queue_state`:
   - Trwały zapis zawartości kolejki pomiędzy sesjami programu.

---

## 3. Integracja z silnikiem audio i MPRIS

- Silnik `AudioEngine` posiada bezpośredni dostęp do `PlaybackQueue`.
- Wykrycie sygnału `PlayerEvent::Eos` (End of Stream) powoduje automatyczne przejście do następnego utworu w kolejce (`play_next()`).
- Zdarzenia D-Bus MPRIS `Next` i `Previous` wywołują metody silnika kolejki i powiadamiają środowisko pulpitu (KDE/GNOME).
