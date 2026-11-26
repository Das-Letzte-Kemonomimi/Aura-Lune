#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: check-release-content.sh <X.Y.Z>
#
# Sprawdza, czy treści wydania są gotowe (krok contentowy "/release" wykonany):
#   * CHANGELOG.md ma nagłówek wersji w poprawnym formacie i niepustą treść,
#   * changelog.json: wpis na początku tablicy, isLatest, komplet 5 języków,
#   * CHANGELOG_PENDING.md jest wyczyszczony,
#   * plakietki README wskazują na tag wydania.
# Używane przez "Prepare release" i "Publish release". Drukuje wszystkie braki.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Użycie: $0 <X.Y.Z>" >&2
    exit 2
fi

fail=0
bad() { echo "❌ $*" >&2; fail=1; }

# CHANGELOG.md
if ! grep -Eq "^## \[${VERSION//./\\.}\] — „.+” - [0-9]{4}-[0-9]{2}-[0-9]{2}\$" CHANGELOG.md; then
    bad "CHANGELOG.md: brak nagłówka '## [$VERSION] — „Kryptonim” - YYYY-MM-DD'."
else
    notes=$(packaging/release-notes.sh "$VERSION" notes)
    [[ -n "${notes//[[:space:]]/}" ]] || bad "CHANGELOG.md: blok wersji $VERSION jest pusty."
    awk -v ver="$VERSION" '
        index($0, "## [" ver "] — ") == 1 { found = 1; next }
        found && /^---/ { sep = 1; exit }
        END { exit sep ? 0 : 1 }
    ' CHANGELOG.md || bad "CHANGELOG.md: blok wersji $VERSION nie kończy się separatorem '---' (notatki wydania zostałyby ucięte)."
fi

# changelog.json
JSON=src/data/changelog.json
if ! jq -e --arg v "$VERSION" '.[0].version == $v and .[0].isLatest == true' "$JSON" >/dev/null 2>&1; then
    bad "$JSON: pierwszy wpis nie jest wersją $VERSION z isLatest=true."
else
    jq -e '[.[1:][] | select(.isLatest == true)] | length == 0' "$JSON" >/dev/null \
        || bad "$JSON: starsze wpisy nadal mają isLatest=true."
    jq -e '[.[0].added[], .[0].fixed[]] | length > 0' "$JSON" >/dev/null \
        || bad "$JSON: wpis $VERSION nie ma żadnych pozycji."
    jq -e '[.[0].added[], .[0].fixed[]] | all(has("pl") and has("en") and has("de") and has("fi") and has("la"))' "$JSON" >/dev/null \
        || bad "$JSON: pozycje wpisu $VERSION nie mają kompletu języków (pl, en, de, fi, la)."
fi

# CHANGELOG_PENDING.md: po wydaniu zostają tylko puste nagłówki sekcji
if sed -n '/^## Oczekujące zmiany/,$p' CHANGELOG_PENDING.md | grep -Eq '^\s*([-*]|[0-9]+\.|####) '; then
    bad "CHANGELOG_PENDING.md: nadal zawiera wpisy — przenieś je do CHANGELOG.md i wyczyść szablon."
fi

# README
for f in README.md README.pl.md; do
    grep -qF "releases/tag/v$VERSION" "$f" || bad "$f: plakietka wersji nie wskazuje na v$VERSION."
done

if (( fail )); then
    echo "" >&2
    echo "Uruchom najpierw krok contentowy wydania (skill /release, patrz docs/RELEASING.md)." >&2
    exit 1
fi
echo "✅ Treści wydania $VERSION są kompletne."
