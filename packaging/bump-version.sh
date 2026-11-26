#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: bump-version.sh <X.Y.Z | X.Y.Z-dev>
#
# Mechaniczna podmiana numeru wersji we wszystkich plikach, które go zawierają.
# Używane przez workflow "Prepare release" oraz lokalnie do podbicia dev na
# kolejny cykl (np. 1.1.7-dev).
#
#  * wersja stabilna (X.Y.Z)  -> pliki aplikacji + pliki "ostatniego wydania"
#                                (install.sh, PKGBUILD*, .SRCINFO, dokumentacja)
#  * wersja dev (X.Y.Z-dev)   -> tylko pliki aplikacji (Cargo/Tauri/npm); pliki
#                                "ostatniego wydania" zostają na wydanym numerze.
#
# Treści (CHANGELOG, changelog.json, plakietki w README) NIE są generowane —
# robi to krok contentowy ("/release"), a skrypt tylko sprawdza, czy są spójne.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

NEW="${1:-}"
if [[ ! "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-dev)?$ ]]; then
    echo "Użycie: $0 <X.Y.Z | X.Y.Z-dev>" >&2
    exit 2
fi

OLD_APP=$(grep -m1 '^version = ' Cargo.toml | cut -d '"' -f 2)
PREV_RELEASE=$(grep -m1 '^pkgver=' packaging/archlinux/PKGBUILD-bin | cut -d= -f2)
[[ -n "$OLD_APP" && -n "$PREV_RELEASE" ]] || { echo "❌ Nie udało się odczytać obecnej wersji." >&2; exit 1; }

echo "🔢 Wersja aplikacji: $OLD_APP -> $NEW (ostatnie wydanie w plikach pakietów: $PREV_RELEASE)"

# --- Pliki aplikacji (zawsze) -------------------------------------------------
sed -i -E '0,/^version = "[^"]*"/s//version = "'"$NEW"'"/' Cargo.toml
sed -i -E '0,/"version": "[^"]*"/s//"version": "'"$NEW"'"/' src-tauri/tauri.conf.json
# package.json + package-lock.json (obie linie "version" w lockfile) jednym poleceniem.
npm version "$NEW" --no-git-tag-version --allow-same-version >/dev/null

if [[ "$NEW" == *-dev ]]; then
    echo "✅ Wersja dev: zmieniono tylko pliki aplikacji."
    exit 0
fi

# --- Pliki "ostatniego wydania" (tylko wersje stabilne) ----------------------
sed -i -E 's/^VERSION="[^"]*"/VERSION="'"$NEW"'"/' install.sh
sed -i -E 's/^pkgver=.*/pkgver='"$NEW"'/' packaging/archlinux/PKGBUILD packaging/archlinux/PKGBUILD-bin
sed -i -E '/^\s*(pkgver|source) = /s/'"${PREV_RELEASE//./\\.}"'/'"$NEW"'/g' packaging/archlinux/.SRCINFO
sed -i -E '1s/\(v[0-9][^)]*\)/(v'"$NEW"')/' docs/FEATURE_MATRIX.md
sed -i -E 's/((Auralune|auralune)_)'"${PREV_RELEASE//./\\.}"'_amd64/\1'"$NEW"'_amd64/g' DEVELOPMENT.md

# --- Kontrola spójności -------------------------------------------------------
fail=0
check_has() { # plik wzorzec opis
    grep -qF -- "$2" "$1" || { echo "❌ $1: brak $3 ($2)" >&2; fail=1; }
}
check_has README.md "releases/tag/v$NEW" "linku/plakietki wersji (uzupełnij w kroku contentowym)"
check_has README.pl.md "releases/tag/v$NEW" "linku/plakietki wersji (uzupełnij w kroku contentowym)"

if [[ "$PREV_RELEASE" != "$NEW" ]]; then
    stale=$(grep -rnF --exclude-dir=node_modules --exclude-dir=target --exclude-dir=target-fedora \
        --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=skills \
        --exclude=package-lock.json --exclude=Cargo.lock --exclude=skills-lock.json \
        --exclude=CHANGELOG.md --exclude=changelog.json --exclude=CHANGELOG_PENDING.md \
        --exclude=PKGBUILD-git --exclude-dir=locales \
        -e "$PREV_RELEASE" \
        install.sh README.md README.pl.md docs/FEATURE_MATRIX.md DEVELOPMENT.md packaging/archlinux \
        2>/dev/null || true)
    if [[ -n "$stale" ]]; then
        echo "❌ Pozostałości poprzedniego wydania $PREV_RELEASE:" >&2
        echo "$stale" >&2
        fail=1
    fi
fi

if (( fail )); then
    echo "❌ Podbicie wersji niekompletne — popraw wskazane pliki." >&2
    exit 1
fi
echo "✅ Wersja $NEW ustawiona we wszystkich plikach."
echo "ℹ️  sha256sums w PKGBUILD-bin/.SRCINFO jest jeszcze stary — po publikacji uruchom packaging/archlinux/update-aur-checksum.sh $NEW"
