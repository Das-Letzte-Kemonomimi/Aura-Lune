#!/usr/bin/env bash
# ==============================================================================
# Aura-Lune (Kitsune Player) — Full Test Suite Runner
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

BOLD="\033[1m"
GREEN="\033[1;32m"
BLUE="\033[1;34m"
PURPLE="\033[1;35m"
CYAN="\033[1;36m"
RED="\033[1;31m"
RESET="\033[0m"

echo -e "${PURPLE}🌸 ========================================================== 🌸${RESET}"
echo -e "${BOLD}       Aura-Lune — Comprehensive Application Test Runner        ${RESET}"
echo -e "${PURPLE}🌸 ========================================================== 🌸${RESET}"
echo ""

# Stage 1: Frontend Linting (oxlint) & Unit/Localization Tests (Vitest)
echo -e "${BLUE}[1/4] Running Frontend Linting (oxlint) & Tests (Vitest)...${RESET}"
npm --prefix "${ROOT_DIR}/apps/desktop" run lint
npm --prefix "${ROOT_DIR}/apps/desktop" test
echo -e "${GREEN}✓ Frontend lint, unit, and i18n parity tests passed.${RESET}"
echo ""

# Stage 2: Frontend TypeScript Check & Production Build
echo -e "${BLUE}[2/4] Running Frontend TypeScript Check & Vite Build...${RESET}"
npm --prefix "${ROOT_DIR}/apps/desktop" run build
echo -e "${GREEN}✓ Frontend build passed.${RESET}"
echo ""

# Stage 3: Rust Workspace Test Suite
echo -e "${BLUE}[3/4] Running Rust Workspace Tests (12 Crates + Integration)...${RESET}"
cargo test --workspace -- --test-threads=1
echo -e "${GREEN}✓ Rust tests passed.${RESET}"
echo ""

# Stage 4: Desktop Backend Smoke Integration Test
echo -e "${BLUE}[4/4] Running Desktop Smoke Integration Test...${RESET}"
cargo test -p auralune-desktop --test desktop_smoke_test -- --nocapture
echo -e "${GREEN}✓ Desktop smoke test passed.${RESET}"
echo ""

echo -e "${GREEN}🌸 ========================================================== 🌸${RESET}"
echo -e "${BOLD}${GREEN}  ALL TESTS PASSED! The application is verified end-to-end.  ${RESET}"
echo -e "${GREEN}🌸 ========================================================== 🌸${RESET}"
