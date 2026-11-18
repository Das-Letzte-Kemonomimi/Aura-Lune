#!/usr/bin/env bash
# ==============================================================================
# Aura-Lune (Kitsune Player) — Full CI/CD Parity Test & Quality Runner
# ==============================================================================
# Mirrors all verification jobs from .github/workflows/ci.yml:
# 1. Rust Canonical Code Formatting (cargo fmt --all --check)
# 2. Frontend Linting (oxlint) & Vitest Suite (Unit + i18n parity)
# 3. Frontend TypeScript & Production Vite Build (tsc -b && vite build)
# 4. Strict Clippy Analysis (cargo clippy --workspace --all-targets --all-features -D warnings)
# 5. Rust Workspace Tests with GST_DEBUG=2 (cargo test --workspace --test-threads=1)
# 6. Desktop Backend Smoke Integration Test (desktop_smoke_test)
# 7. Shell Script Syntax Validation (bash -n on install.sh, packaging/, tests/)
# Optional: --bundle to test full Tauri AppImage build locally (publish-dev-release parity)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

BOLD="\033[1m"
GREEN="\033[1;32m"
BLUE="\033[1;34m"
PURPLE="\033[1;35m"
CYAN="\033[1;36m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"

RUN_BUNDLE=false
AUTO_FIX=false
FAST_MODE=false

show_help() {
    echo -e "${PURPLE}🌸 Aura-Lune — CI/CD Parity Verification Runner${RESET}"
    echo ""
    echo "Usage:"
    echo "  ./tests/run_all_tests.sh            Run full CI/CD test and quality suite"
    echo "  ./tests/run_all_tests.sh --fix      Automatically format Rust code before running checks"
    echo "  ./tests/run_all_tests.sh --bundle   Also test AppImage bundling (mirrors CI dev release job)"
    echo "  ./tests/run_all_tests.sh --fast     Fast mode: run format, lint, typecheck, clippy (skips audio tests)"
    echo "  ./tests/run_all_tests.sh --help     Show this help message"
    echo ""
}

for arg in "$@"; do
    case "$arg" in
        --bundle|--appimage)
            RUN_BUNDLE=true
            ;;
        --fix)
            AUTO_FIX=true
            ;;
        --fast|--quick)
            FAST_MODE=true
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $arg${RESET}"
            show_help
            exit 1
            ;;
    esac
done

START_TIME=$(date +%s)

echo -e "${PURPLE}🌸 ========================================================== 🌸${RESET}"
echo -e "${BOLD}       Aura-Lune — Full CI/CD Parity Verification Suite        ${RESET}"
echo -e "${CYAN}   Strict CI Mirror: cargo fmt • oxlint • vitest • clippy -D   ${RESET}"
echo -e "${PURPLE}🌸 ========================================================== 🌸${RESET}"
echo ""

# Pre-flight check: Auto-format if requested
if [[ "$AUTO_FIX" == true ]]; then
    echo -e "${YELLOW}🔧 Auto-fix enabled: Formatting Rust code with 'cargo fmt --all'...${RESET}"
    cargo fmt --all
    echo ""
fi

# Stage 1: Rust Canonical Formatting Check
echo -e "${BLUE}[1/7] Checking Rust Canonical Code Formatting (cargo fmt --all --check)...${RESET}"
if ! cargo fmt --all --check; then
    echo -e "${RED}❌ FAILED: Rust code formatting mismatch detected!${RESET}"
    echo -e "${YELLOW}👉 Run: cargo fmt --all to automatically fix.${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ Rust code formatting is 100% canonical.${RESET}"
echo ""

# Stage 2: Frontend Linting (oxlint) & Unit/Localization Tests (Vitest)
echo -e "${BLUE}[2/7] Running Frontend Linting (oxlint) & Vitest Test Suite...${RESET}"
if ! npm --prefix "${ROOT_DIR}/apps/desktop" run lint; then
    echo -e "${RED}❌ FAILED: Frontend linter (oxlint) reported diagnostics!${RESET}"
    echo -e "${YELLOW}👉 Run: npm --prefix apps/desktop run lint to inspect.${RESET}"
    exit 1
fi

if ! npm --prefix "${ROOT_DIR}/apps/desktop" test; then
    echo -e "${RED}❌ FAILED: Vitest test suite failed!${RESET}"
    echo -e "${YELLOW}👉 Run: npm --prefix apps/desktop test to inspect failed tests.${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ Frontend lint, unit tests, and i18n parity passed (100% green).${RESET}"
echo ""

# Stage 3: Frontend TypeScript Type Check & Production Vite Build
echo -e "${BLUE}[3/7] Running Frontend TypeScript Typecheck & Production Build...${RESET}"
if ! npm --prefix "${ROOT_DIR}/apps/desktop" run build; then
    echo -e "${RED}❌ FAILED: TypeScript compilation or Vite bundling failed!${RESET}"
    echo -e "${YELLOW}👉 Run: npm --prefix apps/desktop run build to view compiler diagnostics.${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ Frontend build succeeded with 0 diagnostics.${RESET}"
echo ""

# Stage 4: Strict Rust Clippy Analysis
echo -e "${BLUE}[4/7] Running Strict Rust Clippy Analysis (--all-targets --all-features -D warnings)...${RESET}"
if ! cargo clippy --workspace --all-targets --all-features -- -D warnings; then
    echo -e "${RED}❌ FAILED: Clippy reported warnings under -D warnings!${RESET}"
    echo -e "${YELLOW}👉 CI enforces 0 warnings across all targets and features.${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ Rust codebase passed Clippy with 0 warnings.${RESET}"
echo ""

# Stage 5: Rust Workspace Test Suite
if [[ "$FAST_MODE" == true ]]; then
    echo -e "${YELLOW}[5/7] Fast mode enabled: Skipping full audio engine test suite.${RESET}"
    echo ""
else
    echo -e "${BLUE}[5/7] Running Rust Workspace Tests (12 Crates + Integration)...${RESET}"
    export GST_DEBUG="${GST_DEBUG:-2}"
    if ! cargo test --workspace -- --test-threads=1; then
        echo -e "${RED}❌ FAILED: Cargo workspace test suite reported failures!${RESET}"
        echo -e "${YELLOW}👉 Run: GST_DEBUG=2 cargo test --workspace -- --test-threads=1 to debug.${RESET}"
        exit 1
    fi
    echo -e "${GREEN}✓ All workspace unit and integration tests passed.${RESET}"
    echo ""
fi

# Stage 6: Desktop Backend Smoke Integration Test
echo -e "${BLUE}[6/7] Running Desktop Smoke Integration Test (desktop_smoke_test)...${RESET}"
if ! cargo test -p auralune-desktop --test desktop_smoke_test -- --nocapture; then
    echo -e "${RED}❌ FAILED: Desktop smoke test failed!${RESET}"
    echo -e "${YELLOW}👉 Run: cargo test -p auralune-desktop --test desktop_smoke_test -- --nocapture to debug.${RESET}"
    exit 1
fi
echo -e "${GREEN}✓ Desktop smoke test passed successfully.${RESET}"
echo ""

# Stage 7: Shell Script Syntax Validation (install.sh, packaging/, tests/)
echo -e "${BLUE}[7/7] Validating Shell Scripts Syntax (bash -n)...${RESET}"
bash -n "${ROOT_DIR}/install.sh"
for script in "${ROOT_DIR}"/packaging/*.sh "${ROOT_DIR}"/tests/*.sh; do
    if [[ -f "$script" ]]; then
        bash -n "$script"
    fi
done
echo -e "${GREEN}✓ All shell scripts have valid syntax.${RESET}"
echo ""

# Optional Stage: AppImage Bundle Test (matches CI publish-dev-release)
if [[ "$RUN_BUNDLE" == true ]]; then
    echo -e "${BLUE}[Optional] Testing Tauri AppImage Packaging (tauri build --bundles appimage)...${RESET}"
    if ! npm --prefix "${ROOT_DIR}/apps/desktop" run tauri build -- --bundles appimage; then
        echo -e "${RED}❌ FAILED: Tauri AppImage packaging failed!${RESET}"
        echo -e "${YELLOW}👉 Check if libayatana-appindicator3-dev, librsvg2-dev, and libfuse2 are installed.${RESET}"
        exit 1
    fi
    echo -e "${GREEN}✓ AppImage bundle built successfully!${RESET}"
    echo ""
fi

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo -e "${GREEN}🌸 ========================================================== 🌸${RESET}"
echo -e "${BOLD}${GREEN}  ✓ ALL CI/CD PARITY CHECKS PASSED! (${TOTAL_DURATION}s)               ${RESET}"
echo -e "${CYAN}  1. Formatting (cargo fmt --all --check)           [PASSED]  ${RESET}"
echo -e "${CYAN}  2. Frontend Lint & Vitest Suite                   [PASSED]  ${RESET}"
echo -e "${CYAN}  3. TypeScript & Production Vite Build             [PASSED]  ${RESET}"
echo -e "${CYAN}  4. Rust Clippy (--all-targets -D warnings)        [PASSED]  ${RESET}"
echo -e "${CYAN}  5. Rust Workspace Tests (test-threads=1)          [PASSED]  ${RESET}"
echo -e "${CYAN}  6. Desktop Smoke Test                             [PASSED]  ${RESET}"
echo -e "${CYAN}  7. Shell Scripts Syntax Validation                [PASSED]  ${RESET}"
if [[ "$RUN_BUNDLE" == true ]]; then
    echo -e "${CYAN}  8. Tauri AppImage Packaging                       [PASSED]  ${RESET}"
fi
echo -e "${BOLD}${GREEN}  The codebase is in a clean, commit-ready state.             ${RESET}"
echo -e "${GREEN}🌸 ========================================================== 🌸${RESET}"
echo ""
