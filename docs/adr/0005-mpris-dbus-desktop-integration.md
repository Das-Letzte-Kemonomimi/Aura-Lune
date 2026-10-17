# ADR 0005: Integracja z pulpitem Linux przez standard MPRIS 2.2 na magistrali D-Bus

- **Status**: Zaakceptowany
- **Data**: 2026-10-17
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**: Odtwarzacz Auralune musi integrować się ze środowiskiem graficznym Linuksa (KDE Plasma Media Controller, GNOME Shell, Waybar/Hyprland, narzędzia wiersza poleceń typu `playerctl`) oraz obsługiwać sprzętowe klawisze multimedialne na klawiaturze i słuchawkach.

---

## 1. Wybór technologii

Zbadano dostępne rozwiązania integracji z D-Bus w ekosystemie Rust:

1. **Ręczna implementacja z libdbus / zbus**:
   - Daje pełną elastyczność, ale wymaga żmudnego definiowania sygnatur XML introspekcji D-Bus oraz ręcznego mapowania właściwości `org.mpris.MediaPlayer2` i `org.mpris.MediaPlayer2.Player`.
2. **Biblioteka `mpris-server` (oparta na `zbus` z asynchronicznym wsparciem Tokio)**:
   - Dedykowana, dojrzała implementacja pełnej specyfikacji MPRIS v2.2.
   - Wspiera silne typowanie metadanych (`mpris:trackid`, `xesam:title`, `xesam:artist`, `xesam:album`, `mpris:length`, `mpris:artUrl`).
   - Automatycznie generuje i rozsyła sygnały D-Bus `PropertiesChanged` oraz `Seeked`.
   - Zapewnia pełną zgodność ze specyfikacją freedesktop.org.

---

## 2. Decyzja

1. Tworzymy dedykowany moduł **`crates/desktop-integration`** z zależnością od `mpris-server = "0.10"` (oraz wsparciem dla runtime `tokio`).
2. Nazwa usługi D-Bus: `org.mpris.MediaPlayer2.auralune`.
3. Ścieżka obiektu: `/org/mpris/MediaPlayer2`.
4. Architektura dwukierunkowa:
   - **D-Bus -> Silnik Audio**: Zdarzenia z panelu systemowego lub `playerctl` (np. `play`, `pause`, `play_pause`, `stop`, `seek`, `set_volume`) delegowane są bezpośrednio do `AudioEngine`.
   - **Silnik Audio -> D-Bus**: Stan odtwarzacza (`PlaybackState::Playing`, `Paused`, `Stopped`), aktualna pozycja, głośność oraz metadane aktywnego utworu są synchronizowane i rozsyłane jako sygnały D-Bus `PropertiesChanged`.
5. Bezpieczeństwo i spójność:
   - Zgodnie z nadrzędną zasadą `AGENTS.md`, stan MPRIS zawsze odzwierciedla rzeczywisty stan backendu (`audio-engine`), a nie domysły frontendu.
