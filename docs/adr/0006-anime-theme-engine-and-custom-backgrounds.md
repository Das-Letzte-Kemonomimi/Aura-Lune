# ADR 0006: Silnik motywów anime, custom backgrounds i system tokenów CSS

- **Status**: Zaakceptowany
- **Data**: 2026-10-17
- **Autorzy**: Zespół Kitsune Player / Auralune
- **Kontekst**: Wymóg MVP: odtwarzacz ma posiadać estetykę anime, wspierać gotowe motywy wizualne, własne tła użytkowniczki, konfigurowalny overlay i blur, głęboką personalizację bez utraty czytelności oraz bezpieczny import/eksport motywów bez ryzyka wstrzykiwania kodu (XSS/arbitrary code execution).

---

## 1. Architektura motywów i bezpieczeństwo

1. **Format schematu JSON (Wersja 1)**:
   - Motyw jest reprezentowany jako czysty obiekt JSON walidowany ściśle przez deserializator:
     - `id`: identyfikator unikalny (np. `cyber-kitsune`, `sakura-dream`, `tokyo-midnight`, `retro-synthwave`).
     - `name`: czytelna nazwa motywu.
     - `schema_version`: 1.
     - `tokens_json`: tokeny CSS variables (kolory HEX/RGBA, akcenty, rozmycia, promienie, tła kart).
     - `background_ref`: ścieżka względna lub URL do obrazu tła.
     - `overlay_opacity`: float w zakresie 0.0 do 0.9 (gwarancja kontrastu tekstu na tle ilustracji).
     - `blur_radius`: float w zakresie 0.0 do 30.0 px (rozmycie tła w celu zachowania czytelności).
     - `attribution`: informacje o autorze i licencji zasobu graficznego.
2. **Bezpieczeństwo zasobów (Safety Guarantee)**:
   - Żadne skrypty JavaScript ani dowolne reguły CSS nie są ewaluowane dynamicznie (`eval`/`dangerouslySetInnerHTML`).
   - Wartości tokenów to wyłącznie sformatowane kolory i liczby przekazywane do `document.documentElement.style.setProperty(...)`.
   - Obrazy użytkowniczki są walidowane pod kątem rozszerzeń (`.jpg`, `.jpeg`, `.png`, `.webp`) i bezpiecznie kopiowane do katalogu danych aplikacji (`~/.local/share/auralune/backgrounds/`).

---

## 2. Domyślne motywy Anime

Wdrażamy 4 dopracowane presety wizualne bazujące na estetyce anime / cyber-glassmorphism:
1. **Cyber-Kitsune (Domyślny)**: neonowy fiolet (`#a855f7`), cyjan (`#38bdf8`), cyberpunkowy róż (`#ec4899`), głębokie szkło z delikatnym ziarnem.
2. **Sakura Blossom**: pastelowy róż kwiatów wiśni (`#f472b6`), ciepła biel, fuksja (`#db2777`), delikatne jasne szkło.
3. **Tokyo Midnight**: głęboki nocny granat (`#0f172a`), neonowy błękit akcentujący (`#0284c7`), turkus (`#14b8a6`).
4. **Retro Synthwave**: złocisty bursztyn (`#f59e0b`), karmazynowy zachód słońca (`#f43f5e`), fiolet lat 80.

---

## 3. Pamięć trwała

Motywy oraz aktywny motyw są zapisywane w SQLite w tabelach:
- `themes`: definicje motywów, tokeny i parametry tła.
- `app_settings`: para klucz-wartość (np. `active_theme_id`).
