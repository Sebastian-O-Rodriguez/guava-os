# Commands

The Guava OS CLI has two surfaces:

- **Classifier commands** (`doctor`, `status`, `validate`, `next`) — read-only,
  stdin-driven JSON; never call Linear or mutate state.
- **Live commands** (`work`, `pm`, `sync`, `triage`) — query Linear; the
  session gate + project management + consumer convergence.
- **Bootstrap** (`register`) — project setup.

```bash
.guava-os/bin/guava-os <command> [flags]
```

## `doctor`

Validates repo setup (config, registry remotes, Linear data availability,
domain/type/readiness labels, gitignore). Read-only.

## `status`

Shows the executable queue grouped by domain.

```bash
cat issues.json | gos status
cat issues.json | gos status --json
```

Exit 0 if executable work exists for at least one domain.

## `validate`

Detects protocol violations.

```bash
cat issues.json | gos validate
cat issues.json | gos validate --strict
```

Codes: `V302` orphan_sub_issue · `V303` parent_not_active (error) · `V304`
empty_parent · `V305` subtask_overflow (error) · `V307` external_blocker_gap ·
`V400` missing_domain_label (error) · `V402` unknown_label · `V403`
multiple_domain_labels · `V404` readiness_label_count (error) · `V405`
missing_description_sections (error) · `V500` queue_overflow.

Exit 0 if no errors; `--strict` also fails on warnings.

## `next`

One launch directive per domain (highest-priority executable issue).

```bash
gos next < issues.json
gos next --domain backend < issues.json
```

Read-only. Exit 0 if at least one directive.

## `work`

The session gate — queries Linear for open work, grouped by domain.

```bash
gos work          # this project
gos work --all    # every active registry project
gos work --json
```

Exit 0 if open work exists, 1 if none (the session hook closes on 1).

## `sync`

Snapshot + converge a consumer repo against the canonical contract (config,
Linear labels, skills symlinks). Report-first: prints a plan and writes nothing
unless a fix flag is passed.

```bash
gos sync [repo]                 # report-only — exit 0 clean / 1 drift
gos sync --fix [repo]           # prompt [A]ccept/[C]ancel, then apply
gos sync --fix --force [repo]   # apply with no prompt
gos sync --all                  # every active registry project
gos sync --all --fix --force
```

See `docs/architecture/sync-convergence.md`.

## `triage`

Sets the readiness label on open Todo deliverables (`untriaged`,
`ready-for-work`, `needs-rescoping`).

```bash
gos triage          # this project
gos triage --all    # every active registry project
```

## `pm`

All Linear reads/writes — the preferred interface. Linear MCP is a fallback only.

```bash
gos pm search --project guava-os --status Todo --label backend
gos pm create --title "..." --team "Guava AI" --label backend
gos pm link <id> --blocked-by <id>
gos pm move <id> --status "In Progress"
gos pm comment <id> --body "..."
gos pm archive <id>
```

`pm create` / `pm update` accept `--description -` to read the body from stdin
(the documented `$(cat <<'EOF' … EOF)` heredoc form).

## Global flags

| Flag | Commands | Effect |
|---|---|---|
| `--json` | all | machine-readable output |
| `--strict` | `validate` | warnings become errors |
| `--domain <name>` | `next` | filter directives to one domain |
| `--all` | `work` | every registry project |