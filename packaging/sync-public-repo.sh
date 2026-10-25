#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Auralune: Sync Clean Public Repository (Das-Letzte-Kemonomimi/Aura-Lune)
# Automatyczna synchronizacja kodu do publicznego repozytorium bez instrukcji AGENTS.md
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKSPACE_ROOT"

PUBLIC_REMOTE="public"
PUBLIC_URL="https://github.com/Das-Letzte-Kemonomimi/Aura-Lune.git"
PUBLIC_REPO="Das-Letzte-Kemonomimi/Aura-Lune"
CURRENT_VERSION=$(grep -m1 '^version = ' Cargo.toml | cut -d '"' -f 2)
TAG_NAME="v$CURRENT_VERSION"

RELEASE_TITLE=$(grep -E "^## \[$CURRENT_VERSION\]" CHANGELOG.md | sed -E 's/^## \['"$CURRENT_VERSION"'\] — //' || echo "Auralune $CURRENT_VERSION")
RELEASE_NOTES=$(awk -v ver="$CURRENT_VERSION" '
    $0 ~ "^## \\[" ver "\\]" { found=1; next }
    found && /^---/ { exit }
    found { print }
' CHANGELOG.md)

echo "🌸 === Auralune: Synchronizacja z publicznym repozytorium $PUBLIC_REPO (Wersja: $CURRENT_VERSION, Tag: $TAG_NAME) ==="

# 1. Sprawdzenie czy remote 'public' istnieje
if ! git remote get-url "$PUBLIC_REMOTE" &>/dev/null; then
    echo "➕ Dodawanie zdalnego repozytorium $PUBLIC_REMOTE -> $PUBLIC_URL"
    git remote add "$PUBLIC_REMOTE" "$PUBLIC_URL"
fi

# 2. Upewnienie się, że nie ma niezłożonych zmian na bieżącej gałęzi
if [[ -n $(git status --porcelain) ]]; then
    echo "❌ Błąd: Drzewo robocze zawiera niezłożone zmiany. Zrób commit przed synchronizacją."
    exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🌿 Bieżąca gałąź: $CURRENT_BRANCH"

# 3. Przełączenie na tymczasową gałąź release
echo "📦 Przygotowanie gałęzi 'release' z aktualnego $CURRENT_BRANCH..."
git checkout -B release "$CURRENT_BRANCH"

# 4. Usunięcie plików specyficznych dla agentów (AGENTS.md)
if [[ -f "AGENTS.md" ]]; then
    echo "🧹 Usuwanie AGENTS.md z gałęzi publicznej..."
    git rm -f AGENTS.md
    git commit -m "release: clean public distribution (v$CURRENT_VERSION) without internal agent docs"
fi

# 5. Wypchnięcie gałęzi 'release' jako 'main' do publicznego repozytorium
echo "🚀 Wypychanie kodu do $PUBLIC_REMOTE/main..."
git push -f "$PUBLIC_REMOTE" release:main

# 6. Wypchnięcie tagu wydania do publicznego repozytorium
echo "🏷️ Wypychanie tagu $TAG_NAME do $PUBLIC_REMOTE..."
git tag -f "$TAG_NAME"
git push -f "$PUBLIC_REMOTE" "$TAG_NAME"

# 7. Powrót do gałęzi pierwotnej
git checkout "$CURRENT_BRANCH"
echo "🔙 Powrót do gałęzi $CURRENT_BRANCH."

# 8. Utworzenie lub aktualizacja wydania na GitHubie (GitHub Release) z AppImage
APPIMAGE_PATH="target/release/bundle/appimage/Auralune_${CURRENT_VERSION}_amd64.AppImage"
if [[ -f "$APPIMAGE_PATH" ]]; then
    echo "📦 Sprawdzanie wydania $TAG_NAME na $PUBLIC_REPO..."
    if gh release view "$TAG_NAME" --repo "$PUBLIC_REPO" &>/dev/null; then
        echo "🔄 Wydanie $TAG_NAME już istnieje na $PUBLIC_REPO, przesyłanie AppImage..."
        gh release upload "$TAG_NAME" "$APPIMAGE_PATH" --repo "$PUBLIC_REPO" --clobber
    else
        echo "✨ Tworzenie nowego wydania $TAG_NAME na $PUBLIC_REPO..."
        gh release create "$TAG_NAME" "$APPIMAGE_PATH" \
            --repo "$PUBLIC_REPO" \
            --title "Auralune $CURRENT_VERSION — $RELEASE_TITLE" \
            --notes "$RELEASE_NOTES"
    fi
    echo "✅ Wydanie $TAG_NAME w $PUBLIC_REPO jest gotowe i zawiera AppImage!"

else
    echo "⚠️ Ostrzeżenie: Plik $APPIMAGE_PATH nie został znaleziony. Pomiń upload AppImage."
fi

echo "🎉 Synchronizacja z $PUBLIC_REPO zakończona sukcesem!"
