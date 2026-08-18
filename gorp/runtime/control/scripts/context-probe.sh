#!/usr/bin/env bash
# GOS-76-lite: reproducible controlled-diff context probe.
# Runs a FIXED trivial task under different OMP configs and prints a token table,
# so the token contribution of each context layer is measurable by differencing.
#
# Usage: scripts/context-probe.sh [dir]
set -uo pipefail
DIR="${1:-$(pwd)}"
PARSER="$(cd "$(dirname "$0")" && pwd)/_parse_usage.py"
PROBE="Reply with exactly: OK"

probe() {
  local label="$1"; shift
  local out
  out=$(cd "$DIR" && omp -p --mode json "$@" "$PROBE" 2>/dev/null | python3 "$PARSER")
  printf "%-40s %s\n" "$label" "$out"
}

echo "=== GOS-76-lite controlled-diff (probe: '$PROBE') ==="
probe "baseline (default flags)"
probe "no-skills/rules/ext"           --no-skills --no-rules --no-extensions
probe "lean (minimal-config + no-skills)" --config "$(cd "$(dirname "$0")/.." && pwd)/omp-minimal.yml" --no-skills --no-rules --no-extensions
