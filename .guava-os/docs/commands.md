> **`CURRENT` / `ADAPTER_SPECIFIC` (labeled at Wave A closeout, 2026-07-14).**
> Documents the read-only Linear import/classifier CLI. Linear is an input
> format here, not the execution authority — the authoritative execution model
> is the Gorp-native persisted graph (see
> `~/dev/gorp/reference/architecture.md`).

# Commands

All available Guava OS commands. There are three: `doctor`, `status`, `validate`.

All commands are read-only. None mutate Linear, git, or any external state.

## Running the CLI

```bash
# Recommended
.guava-os/bin/guava-os <command> [flags]

# Via npm script
npm run guava-os -- <command> [flags]

# Via npx
npx tsx .guava-os/src/cli.ts <command> [flags]
```

## `doctor`

Validates repo setup.

```bash
# Without Linear data
.guava-os/bin/guava-os doctor

# With Linear label data (enables persona-label cross-check)
echo '{"issues": [], "labels": ["architect", "backend", "frontend", "qa"]}' | .guava-os/bin/guava-os doctor

# JSON output
.guava-os/bin/guava-os doctor --json
```

**Stdin**: Optional. Object `{"issues": [...], "labels": [...]}` or bare array `[...]`.

**Exit 0**: All checks pass.
**Exit 1**: One or more checks fail.

**Example output:**

```
DOCTOR

  ✓ config         .guava-os/config.json valid
  ✓ claude-md      CLAUDE.md present, authority hierarchy found
  ✓ agents         4/4 persona AGENT.md files found
  ✓ protocol       3/3 process docs found
  ✓ linear         Guava AI / RoutineMe — issue graph loaded
  ✓ labels         4/4 persona labels found in Linear data
  ✓ gitignore      .guava-os/manifest.json is gitignored

RESULT: 7/7 passed
```

## `status`

Shows execution queue by persona.

```bash
cat issues.json | .guava-os/bin/guava-os status
cat issues.json | .guava-os/bin/guava-os status --json
```

**Stdin**: Required. JSON array of Linear issues.

**Exit 0**: Executable work exists for at least one persona.
**Exit 1**: No executable work for any persona.

**Example output:**

```
EXECUTABLE
  architect:    (none)
  backend:      GUA-27 [P0/Urgent] "Add tests for category fallback"
                GUA-17 [P1/High] "Build action executor"
  frontend:     (none)
  qa:           (none)

NOT_PROMOTED
  GUA-16  [architect] "Define Action type + Zod schemas"

BLOCKED (dependency relations not loaded — blocker detection unavailable)

PARENTS
  GUA-9  Todo          2/3   subtasks  (2 Done, 1 Todo)
  GUA-6  Todo          0/3   subtasks  (1 Todo, 2 Backlog)

SUMMARY: 2 executable, 1 not promoted, 0 blocked, 0 invalid, 2 active parents
```

**JSON output** includes `executable`, `not_promoted`, `blocked`, `invalid`, `parents`, `summary`, and `capabilities` fields.

## `validate`

Detects protocol violations.

```bash
cat issues.json | .guava-os/bin/guava-os validate
cat issues.json | .guava-os/bin/guava-os validate --json
cat issues.json | .guava-os/bin/guava-os validate --strict
```

**Stdin**: Required. JSON array of Linear issues.

**Exit 0**: No error-severity violations.
**Exit 1**: One or more errors.
**Exit 1 with --strict**: Any violation (error or warning).

**Example output (errors + warnings):**

```
ERRORS
  V303 parent_not_active          GUA-52       Parent GUA-1 status "Backlog" is not active
  V400 missing_persona_label      GUA-50       Sub-issue has no persona label

WARNINGS
  V302 orphan_sub_issue           GUA-53       Sub-issue references parent GUA-GONE not found

SUMMARY: 2 errors, 1 warnings, 3 total
```

**Example output (clean graph):**

```
VALIDATE: no violations found
```

**JSON output** includes `summary` (`errors`, `warnings`, `total`) and `violations` array.

## Global Flags

| Flag | Commands | Effect |
|------|----------|--------|
| `--json` | All | Output machine-readable JSON instead of human text |
| `--strict` | `validate` only | Warnings become errors (affect exit code) |
| `--help` | N/A | Show usage |
