#!/usr/bin/env bash
# claude-permissions.sh — Pre-approve Claude for common dev commands
#
# Usage: source this before launching claude, or add to your shell profile.
# This sets up the allowlist so Claude doesn't prompt for routine operations.
#
# Docs: https://docs.anthropic.com/claude-code/docs/permissions
#
# TODO: Replace with actual Claude Code permissions config once format is confirmed.
#       Current stub — fill in based on your workflow.

set -euo pipefail

CLAUDE_SETTINGS="${HOME}/.claude/settings.json"

# Backup existing settings
if [[ -f "$CLAUDE_SETTINGS" ]]; then
  cp "$CLAUDE_SETTINGS" "${CLAUDE_SETTINGS}.bak"
fi

# Ensure directory exists
mkdir -p "$(dirname "$CLAUDE_SETTINGS")"

# Write permissions config
# Adjust the allow list to match commands you want auto-approved.
cat > "$CLAUDE_SETTINGS" << 'EOF'
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(pnpm lint)",
      "Bash(pnpm build)",
      "Bash(pnpm test)",
      "Bash(pnpm dev:*)",
      "Bash(pnpm install)",
      "Bash(pnpm ci:*)",
      "Bash(shoal *)",
      "Bash(opencode *)",
      "Bash(docker compose *)",
      "Bash(npx prisma *)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(head *)",
      "Bash(tail *)",
      "Bash(wc *)",
      "Bash(which *)",
      "Bash(echo *)",
      "Bash(mkdir *)",
      "Read",
      "Write",
      "Edit",
      "Glob",
      "Grep"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force*)",
      "Bash(git reset --hard*)",
      "Bash(DROP TABLE*)",
      "Bash(curl * | bash)",
      "Bash(sudo *)"
    ]
  }
}
EOF

echo "Claude permissions written to $CLAUDE_SETTINGS"
echo "Backup at ${CLAUDE_SETTINGS}.bak (if existed)"
echo ""
echo "Allowed: git, pnpm, shoal, opencode, docker, prisma, file ops"
echo "Denied: rm -rf, force push, hard reset, destructive SQL, sudo"
