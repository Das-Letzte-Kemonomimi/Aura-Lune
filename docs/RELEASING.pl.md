# Wydawanie Auralune (Releasing)

[🇬🇧 English](RELEASING.md) | 🇵🇱 **Polski**

Jak przygotować wydanie Auralune jednym poleceniem lokalnie i opublikować oba kanały zwykłym `git push`. Szczegółowa specyfikacja dla agentów i kontrybutorów: [`docs/developer/release-pipeline.md`](developer/release-pipeline.md).

## 1. Przegląd

| Kanał | Wyzwalacz | Wynik |
|---|---|---|
| **dev** | Push na `dev` (`.github/workflows/ci.yml` → `publish-dev-release`) | ruchomy pre-release `dev-build` z notatkami z `changelog.json`, instaluje się jako `auralune-dev` |
| **stable** | Push na `main` (`.github/workflows/ci.yml` → `verify-stable-release` + `build-stable-release` + `publish-stable-release`) | wydanie GitHub `vX.Y.Z` z `AppImage`, `.deb` i `SHA256SUMS` (pomijane bezpiecznie, jeśli tag `vX.Y.Z` już istnieje) |

```
  dev (1.1.6-dev, przystępne opisy "isDev": true w src/data/changelog.json)
   │
   ▼  npm run release:prepare -- [patch|minor|major|X.Y.Z] --codename "..."
   │    • promuje changelog.json, aktualizuje plakietki README, podbija wersje
   │    • uruchamia ./tests/run_all_tests.sh --fix i check-release-content.sh --strict-versions
   │    • commituje dev, scala dev ──▶ main (--no-ff), podbija dev na X.Y.(Z+1)-dev
   ▼
  git push origin main dev
   ├──▶ origin/main ──▶ ci.yml ──▶ buduje AppImage + .deb + SHA256SUMS ──▶ publikuje vX.Y.Z
   └──▶ origin/dev  ──▶ ci.yml ──▶ buduje dev AppImage + SHA256SUMS    ──▶ aktualizuje dev-build
```

## 2. Jednorazowa konfiguracja GitHub

1. **Sekret `RELEASE_TOKEN`** (*Settings → Secrets and variables → Actions*, fine-grained PAT z *Contents: Read and write* i *Administration: Read and write*): pozwala CI zaktualizować opis repozytorium ("About") przy wydaniu `vX.Y.Z` (bez niego reszta działa, a w logu pojawia się ostrzeżenie).

## 3. Wydanie krok po kroku

### 3.1 Przygotowanie lokalne (`npm run release:prepare`)

Upewnij się, że gałąź `dev` jest czysta, a `src/data/changelog.json` ma aktywny blok `isDev: true` z przystępnymi opisami w 5 językach:

```bash
# Podgląd bez zmian w plikach i gicie:
npm run release:prepare -- minor --codename "Harmonic Horizons" --codename-pl "Harmoniczne Horyzonty" --dry-run

# Pełne przygotowanie (promocja changeloga, plakietki, podbicie wersji, testy, merge do main, start kolejnego -dev):
npm run release:prepare -- minor --codename "Harmonic Horizons" --codename-pl "Harmoniczne Horyzonty"
```

- Jeśli na GitHubie włączona jest ochrona gałęzi `main` (wymagany PR), dodaj flagę `--pr` zamiast lokalnego merge'a do `main`.

### 3.2 Przegląd i push (`git push`)

Sprawdź przygotowane commity (`git log --graph --oneline -n 6 main dev`), a następnie wypchnij obie gałęzie naraz:

```bash
git push origin main dev
```

Nie trzeba klikać żadnych ręcznych workflowów w GitHub Actions: push na `main` automatycznie buduje i publikuje `vX.Y.Z`, a push na `dev` odświeża `dev-build` dla `X.Y.(Z+1)-dev`.

### 3.3 Sprawdzenie wyniku i AUR

- Sprawdź *Actions* i *Releases* (`gh release view vX.Y.Z`): są pliki `Auralune_X.Y.Z_amd64.AppImage`, `.deb` oraz `SHA256SUMS`.
- Po opublikowaniu wydania `vX.Y.Z` zaktualizuj pakiet AUR (`auralune-bin`):
  ```bash
  npm run release:aur -- X.Y.Z
  ```

## 4. Zabezpieczenia i naprawa błędów

- **Blokada `-dev` na `main`**: wypchnięcie wersji `-dev` na `main` natychmiast zatrzymuje CI błędem. Zwykły push (np. poprawka dokumentacji na `main`), gdy tag `vX.Y.Z` już istnieje, przechodzi CI i bezpiecznie pomija publikację.
- **Próba generalna (dry run)**: uruchom *Actions → CI/CD & Release Pipeline → Run workflow* na gałęzi `main` z `dry_run: true`, aby zbudować paczki i zostawić szkic wydania.
- **Błędne wydanie po publikacji**: `gh release delete vX.Y.Z --yes --cleanup-tag`, popraw na `dev`, przygotuj wydanie ponownie i wypchnij.

## 5. Skrypty i polecenia pomocnicze

| Polecenie / Skrypt | Zastosowanie |
|---|---|
| `npm run release:prepare` | Promocja changeloga, plakietki README, podbicie wersji, pełne testy, merge `dev` → `main` i start kolejnego `-dev` (`scripts/release.mjs`). |
| `npm run release:check [X.Y.Z]` | Sprawdza `changelog.json` oraz zgodność wersji w Cargo, npm, Tauri, `install.sh`, plikach Arch, `FEATURE_MATRIX.md`, `DEVELOPMENT.md` i `README*.md`. |
| `npm run release:aur [X.Y.Z]` | Pobiera `SHA256SUMS` z opublikowanego `vX.Y.Z`, aktualizuje `PKGBUILD-bin` + `.SRCINFO`, commituje i wysyła na AUR. |
| `packaging/bump-version.sh <X.Y.Z\|X.Y.Z-dev>` | Podmienia wersje w plikach aplikacji i pakietów (dla `-dev` tylko w plikach aplikacji). |
| `packaging/check-release-content.sh <X.Y.Z> [--strict-versions]` | Sprawdza pięciojęzyczny `changelog.json`, plakietki README oraz opcjonalnie spójność wszystkich plików. |
| `packaging/release-notes.sh <X.Y.Z> <codename\|date\|notes>` | Wyciąga metadane i notatki wydania z `src/data/changelog.json` przez `scripts/changelog.mjs`. |
