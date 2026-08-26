#!/usr/bin/env bash
# add-skill.sh <name> [--repos repo[,...]] — link a canonical skill into consumers.
# Real files must already exist at ~/.agents/skills/<name> (see add-skill/SKILL.md).
# Defaults to linking into guava-os + resume-site .omp, + user-level ~/.claude.
set -u
NAME="$1"
CANON="$HOME/.agents/skills/$NAME"
if [ -z "$NAME" ]; then echo "usage: add-skill.sh <name>" >&2; exit 2; fi
if [ ! -f "$CANON/SKILL.md" ]; then echo "missing canonical skill: $CANON" >&2; exit 1; fi

DIRS=(
  "/Users/sebroot/dev/guava-os/.omp/skills"
  "/Users/sebroot/dev/repos/resume-site/.omp/skills"
  "$HOME/.claude/skills"
)
missing=0
for d in "${DIRS[@]}"; do
  if [ ! -d "$d" ] && ! mkdir -p "$d" 2>/dev/null; then
    echo "skip (no dir): $d" >&2; continue
  fi
  rm -f "$d/$NAME"
  ln -s "$CANON" "$d/$NAME"
  [ -e "$d/$NAME" ] || { echo "broken link created: $d/$NAME" >&2; missing=1; }
done
if [ "$missing" -eq 0 ]; then echo "linked $NAME into ${#DIRS[@]} consumers"; fi
echo "verify: test -f $CANON/SKILL.md ; find <roots> -name SKILL.md"