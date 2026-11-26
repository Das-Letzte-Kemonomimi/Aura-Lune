# Wydawanie Auralune

[🇬🇧 English](RELEASING.md) | 🇵🇱 Polski

Jak powstaje stabilne wydanie Auralune. Wydania stabilne buduje i publikuje GitHub Actions, ale **dopiero po naciśnięciu przycisku**: merge pull requesta niczego nie publikuje.

## 1. Przegląd

| Kanał | Wyzwalacz | Efekt |
|---|---|---|
| **dev** | każdy push na `dev` (automatycznie, `ci.yml` → `publish-dev-release`) | ruchome wydanie testowe `dev-build`, instaluje się jako `auralune-dev` |
| **stable** | dwa ręczne workflow (poniżej) | wydanie `vX.Y.Z` z AppImage i `SHA256SUMS` |

```
dev ──(krok contentowy: CHANGELOG.md, changelog.json, plakietki README, wyczyszczenie CHANGELOG_PENDING.md)──▶ push
  │
  ▼  Actions ▸ "Prepare release" ▸ Run workflow            (ręcznie, na dev)
release/vX.Y.Z  =  dev + "chore(release): bump version to X.Y.Z (Kryptonim)"
  │  PR → main
  ▼  przeglądasz i mergujesz (merge commit)                (nic nie jest publikowane)
main
  │
  ▼  Actions ▸ "Publish release" ▸ Run workflow            (ręcznie, na main)
verify ─┬─ ci (pełny ci.yml na tym commicie) ────┐
        └─ build-appimage ───────────────────────┴─▶ publish (środowisko "release")
                                                       szkic wydania → wszystkie pliki → publikacja
```

## 2. Jednorazowa konfiguracja

Wykonaj raz w ustawieniach repozytorium GitHub.

1. **Sekret `RELEASE_TOKEN`** (Settings → Secrets and variables → Actions). Fine-grained personal access token ograniczony do tego repozytorium z uprawnieniami *Contents: Read and write*, *Pull requests: Read and write* i *Administration: Read and write*. Służy do dwóch rzeczy, których wbudowany `GITHUB_TOKEN` nie potrafi:
   - pull request otwarty przez `GITHUB_TOKEN` **nie** uruchamia CI, a otwarty przez PAT — tak;
   - zmiana opisu repozytorium („About”) wymaga uprawnień administratora.

   Bez sekretu wszystko nadal działa, ale PR wydania nie ma sprawdzeń, a opis repozytorium nie jest aktualizowany (w logu pojawia się ostrzeżenie). Wtedy włącz też *Settings → Actions → General → Allow GitHub Actions to create and approve pull requests*.
2. **Środowisko `release`** (Settings → Environments → New environment). Ustaw *Deployment branches* na `main`. Opcjonalnie dodaj siebie jako *Required reviewer*: job publikujący czeka wtedy na kliknięcie **Approve** po zakończeniu wszystkich zielonych buildów. To ostateczna bramka „akceptuję”. (Jeśli jesteś jedynym recenzentem, zostaw *Prevent self-review* wyłączone.)
3. **Opcjonalnie: ochrona `main`** (wymagany pull request i sprawdzenia CI), aby „zmergowane” naprawdę oznaczało „sprawdzone i zielone”.

## 3. Wydanie krok po kroku

### 3.1 Krok contentowy (na `dev`)

Pięciojęzycznego changeloga nie da się wygenerować mechanicznie, więc powstaje **przed** uruchomieniem workflow (poproś agenta: `/release`, albo zrób to ręcznie):

- dodaj `## [X.Y.Z] — „Kryptonim” - RRRR-MM-DD` do `CHANGELOG.md` (zostaw separator `---` po bloku, stąd wycinane są notatki wydania);
- dodaj wpis na początku `apps/desktop/src/data/changelog.json` z `isLatest: true` (i zdejmij go z poprzedniego wpisu), z wszystkimi językami: `pl`, `en`, `de`, `fi`, `la`;
- zaktualizuj plakietki wersji i linki `releases/tag/vX.Y.Z` w `README.md` i `README.pl.md`;
- wyczyść `CHANGELOG_PENDING.md` do pustego szablonu;
- uruchom `./tests/run_all_tests.sh --fix`, zrób commit i wypchnij `dev`.

Wynik możesz sprawdzić bez CI: `packaging/check-release-content.sh X.Y.Z`.

### 3.2 Actions → Prepare release

*Actions → Prepare release → Run workflow*, gałąź **dev**.

- `version`: puste = obecna wersja dev bez `-dev` (`1.1.6-dev` → `1.1.6`), albo wpisz `X.Y.Z`.
- Workflow sprawdza wersję (semver, nowsza od ostatniego tagu, tag i gałąź jeszcze nie istnieją) oraz treści z kroku 3.1. Każdy problem jest opisany czytelnym komunikatem i nic nie zostaje zmienione.
- Następnie uruchamia `packaging/bump-version.sh`, commituje `chore(release): bump version to X.Y.Z (Kryptonim)` na gałęzi `release/vX.Y.Z` i otwiera pull request do `main` z notatkami wydania w opisie.

### 3.3 Przegląd i merge

Przejrzyj PR (diff zawiera tylko numery wersji) i poczekaj na sprawdzenia. Zmerguj jako **merge commit**, nie squash, aby `dev` mógł później połączyć się z `main` bez konfliktów. Nic nie jest jeszcze publikowane.

### 3.4 Actions → Publish release

*Actions → Publish release → Run workflow*, gałąź **main**.

| Parametr | Znaczenie |
|---|---|
| `dry_run` | Zbuduj wszystko, ale zostaw wydanie jako **szkic** i nie zmieniaj opisu repozytorium. Użyj, gdy coś w pipeline się zmieniło. |

Co się dzieje:

1. **verify**: tylko z `main`; wersja musi być stabilna (bez `-dev`); tag `vX.Y.Z` nie może istnieć; treści wydania muszą być kompletne.
2. **ci**: pełny `ci.yml` (formatowanie, clippy, testy, lint, build) na dokładnie tym commicie.
3. **build-appimage** działa równolegle z CI. AppImage powstaje z `AURALUNE_BUILD_CHANNEL=stable` i musi nazywać się dokładnie `Auralune_X.Y.Z_amd64.AppImage` (tej nazwy oczekują `install.sh`, pakiet AUR i aktualizator).
4. **publish** (środowisko `release`, czeka na akceptację, jeśli ustawiłeś recenzentów): tworzy `SHA256SUMS`, tworzy wydanie **jako szkic ze wszystkimi plikami jednym wywołaniem**, po czym je publikuje (`--latest`) i aktualizuje opis repozytorium. Ponieważ szkic staje się publiczny dopiero po wgraniu wszystkich plików, aktualizator w aplikacji nigdy nie zobaczy wydania bez sumy kontrolnej.

Podsumowanie przebiegu pokazuje sumy kontrolne i pozostałe kroki ręczne.

### 3.5 Sprawdzenie wyniku

- `gh release view vX.Y.Z` albo strona *Releases*: są AppImage i `SHA256SUMS`.
- `curl -fsSL https://raw.githubusercontent.com/Das-Letzte-Kemonomimi/Aura-Lune/main/install.sh | bash` instaluje nową wersję.
- Starsza instalacja stable pokazuje w nagłówku aplikacji odznakę aktualizacji.

## 4. Po wydaniu

1. **AUR** (ręcznie, potrzebny Twój klucz SSH do AUR). Pakiet `auralune-bin` rozpakowuje AppImage wydania do `/opt/auralune` (razem z dołączonymi bibliotekami) i dodaje launcher `/usr/bin/auralune`, wpis pulpitu i ikony, więc `pacman -R auralune-bin` usuwa go w całości. Na `dev` lub w dowolnym checkoutcie z wydaniem:
   ```bash
   packaging/archlinux/update-aur-checksum.sh X.Y.Z   # wpisuje prawdziwą sumę sha256 AppImage z opublikowanego SHA256SUMS
   git commit -am "chore(aur): update AppImage sha256 checksum for vX.Y.Z"
   packaging/archlinux/publish-to-aur.sh
   ```
2. **Merge wsteczny i start kolejnego cyklu na `dev`**:
   ```bash
   git checkout dev && git pull
   git merge origin/main                       # sprowadza merge commit wydania z powrotem na dev
   packaging/bump-version.sh X.Y.(Z+1)-dev     # zmienia tylko pliki Cargo/Tauri/npm
   git commit -am "chore: start X.Y.(Z+1)-dev"
   git push
   ```

## 5. Próby i naprawa błędów

- **Próba generalna**: uruchom *Publish release* z włączonym `dry_run`. W *Releases* zostaje szkic `vX.Y.Z`; sprawdź pliki i usuń szkic. Kolejne uruchomienie samo usuwa pozostały szkic. Dla szkicu nie powstaje tag.
- **Któryś job nie przeszedł przed `publish`**: nic nie zostało wydane. Napraw przyczynę i uruchom *Publish release* ponownie.
- **Wydanie po publikacji jest błędne**: `gh release delete vX.Y.Z --yes --cleanup-tag`, popraw na `dev` i zacznij od *Prepare release* (stara gałąź `release/vX.Y.Z` musi być wcześniej usunięta).
- **Prepare release utworzył zły PR**: zamknij go i usuń gałąź `release/vX.Y.Z`, popraw `dev` i uruchom ponownie.

## 6. Skrypty pomocnicze

| Skrypt | Do czego służy |
|---|---|
| `packaging/bump-version.sh <X.Y.Z\|X.Y.Z-dev>` | Podmienia wersję we wszystkich plikach (Cargo, Tauri, npm + lockfile, `install.sh`, PKGBUILD, `.SRCINFO`, dokumentacja). Podbicie stabilne sprawdza też, czy plakietki README zostały zaktualizowane; podbicie `-dev` zmienia tylko pliki aplikacji. |
| `packaging/check-release-content.sh <X.Y.Z>` | Sprawdza changelog, pięciojęzyczny `changelog.json`, pusty `CHANGELOG_PENDING.md` i plakietki README. |
| `packaging/release-notes.sh <X.Y.Z> <codename\|date\|notes>` | Wyciąga z `CHANGELOG.md` kryptonim, datę lub notatki wersji. |
| `packaging/archlinux/update-aur-checksum.sh <X.Y.Z>` | Wpisuje sumę opublikowanego AppImage do `PKGBUILD-bin` i `.SRCINFO`. |
| `packaging/archlinux/publish-to-aur.sh` | Wypycha `auralune-bin` na AUR. |

Workflow: `.github/workflows/ci.yml` (jakość + ruchome wydanie dev, wywoływalny też z innych workflow), `release-prepare.yml`, `release-publish.yml`; wspólna konfiguracja buildu: `.github/actions/setup-build-env`.

## 7. Rozwiązywanie problemów

| Objaw | Przyczyna / rozwiązanie |
|---|---|
| Prepare kończy się błędem „CHANGELOG.md: brak nagłówka…” lub „changelog.json…” | Brakuje kroku contentowego (3.1) albo jest niekompletny. Uruchom lokalnie `packaging/check-release-content.sh X.Y.Z`. |
| Prepare: „Pozostałości poprzedniego wydania” | Któryś plik nadal ma starą wersję, zwykle plakietka w README. Popraw na `dev` i uruchom ponownie. |
| PR wydania nie ma sprawdzeń | Brakuje `RELEASE_TOKEN` (PR otwarty przez `GITHUB_TOKEN` nie uruchamia CI). Publish i tak uruchamia pełne CI. |
| Publish: „wersja nie jest stabilna” | PR wydania nie został jeszcze zmergowany do `main`. |
| Publish: „tag już istnieje” | `vX.Y.Z` został już wydany. Podbij wersję albo usuń wydanie i tag (sekcja 5). |
| Publish nie startuje, „requesting contents: write” | Job `ci` w `release-publish.yml` musi zachować `permissions: contents: write` (wywołuje `ci.yml`, w którym jest job publikacji dev). |
| Opis repozytorium nie został zaktualizowany | Brak `RELEASE_TOKEN` lub bez uprawnienia *Administration*. W logu jest ostrzeżenie. |
| Publish czeka w nieskończoność | Środowisko `release` wymaga akceptacji: otwórz przebieg i kliknij **Review deployments → Approve**. |
