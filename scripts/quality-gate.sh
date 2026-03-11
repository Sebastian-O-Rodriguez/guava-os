#!/bin/bash
# Run all quality gates for RoutineMe
# Usage: ./scripts/quality-gate.sh [target]
# Targets: types, lint, format, build, test, all (default)

set -euo pipefail

TARGET="${1:-all}"
PASS=0
FAIL=0

run_gate() {
  local name="$1"
  local cmd="$2"
  echo -n "  $name... "
  if eval "$cmd" > /dev/null 2>&1; then
    echo "✓ pass"
    ((PASS++))
  else
    echo "✗ FAIL"
    ((FAIL++))
  fi
}

echo "=== RoutineMe Quality Gates ==="
echo ""

case "$TARGET" in
  types)  run_gate "TypeScript" "npx tsc --noEmit" ;;
  lint)   run_gate "ESLint" "npx eslint . --max-warnings 0" ;;
  format) run_gate "Prettier" "npx prettier --check ." ;;
  build)  run_gate "Build" "npx next build" ;;
  test)   run_gate "Tests" "npx vitest run" ;;
  prisma) run_gate "Prisma" "npx prisma validate" ;;
  all)
    run_gate "Prisma" "npx prisma validate"
    run_gate "TypeScript" "npx tsc --noEmit"
    run_gate "ESLint" "npx eslint . --max-warnings 0"
    run_gate "Prettier" "npx prettier --check ."
    run_gate "Build" "npx next build"
    run_gate "Tests" "npx vitest run"
    ;;
  *)
    echo "Unknown target: $TARGET"
    echo "Usage: quality-gate.sh [types|lint|format|build|test|all]"
    exit 1
    ;;
esac

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
