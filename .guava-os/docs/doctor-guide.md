# `doctor` — repo setup checks

Read-only. Validates the repo's guava-os setup.

```bash
guava-os doctor
echo '{"issues": [], "labels": ["task","reviewer","scout","designer","sonic","librarian"]}' | guava-os doctor
```

## Checks

| Check | Passes when |
|---|---|
| `config` | `.guava-os/config.json` exists and parses |
| `agents-md` | `AGENTS.md` present (advisory) |
| `protocol` | configured process docs exist |
| `linear` | caller supplied issue data via stdin |
| `labels` | every configured role has a matching Linear label |
| `gitignore` | `manifest_path` is gitignored |
| `git-remote` | registry remotes match local `origin` (advisory) |

Exit 0 if all pass, 1 if any fail.