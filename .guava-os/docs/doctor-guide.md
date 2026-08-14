# Doctor Guide

How to read and use `guava-os doctor` output.

## What Doctor Checks

| Check | What It Validates | Requires Stdin |
|-------|------------------|----------------|
| config | `.guava-os/config.json` exists and parses | No |
| agents-md | `AGENTS.md` exists and contains "Authority Hierarchy" section (advisory) | No |
| protocol | All process docs referenced in config exist | No |
| linear | Linear issue data was provided by caller via stdin | Yes |
| labels | Every configured persona has a matching label in Linear data | Yes |
| gitignore | `.guava-os/manifest.json` is in `.gitignore` | No |

## What Doctor Does NOT Check
- Linear network connectivity (the classifier has no network layer; `pm` handles it)
- Issue graph structure (that's `validate`)
- Execution readiness (that's `status`)
- Code quality or build state
- Git state or branch naming

Doctor validates **local repo and config readiness**. It answers: "Is this repo set up correctly for Guava OS?"

## Stdin Requirements

Without stdin, doctor runs 4 of 6 checks. The `linear` and `labels` checks require data.

**Minimal stdin for full check:**

```bash
echo '{"issues": [], "labels": ["architect", "backend", "frontend", "qa"]}' | .guava-os/bin/guava-os doctor
```

The `issues` array can be empty — doctor only needs it to confirm data was provided. The `labels` array must contain the actual label names from Linear.

## Config Requirements

Doctor validates that `.guava-os/config.json` exists. It does not validate the JSON against the schema (that's a future enhancement). If the file parses as JSON, the check passes.

## AGENTS.md Requirements

Doctor checks that `AGENTS.md` exists at the repo root and contains the text
"Authority Hierarchy". This check is **advisory** — AGENTS.md is optional for
execution. A missing AGENTS.md (or one without an authority reference) produces
a passing, advisory result; it never hard-fails doctor. Bootstrap completeness
(including the authority hierarchy) is owned by GOS-34 ordering, not by the
`doctor` command.

When both `issues` and `labels` are provided in stdin, doctor cross-checks:

- Every label in `config.labels.persona_labels` exists in the Linear labels
- The `config.labels.qa_label` exists in the Linear labels

If a configured persona has no matching Linear label, the check fails and reports which labels are missing.

## Example Output

**Full pass:**

```
DOCTOR

  ✓ config         .guava-os/config.json valid
  ✓ agents-md      AGENTS.md present, authority hierarchy found
  ✓ protocol       0/0 process docs found
  ✓ linear         Guava AI / guava-os — issue graph loaded
  ✓ labels         4/4 persona labels found in Linear data
  ✓ gitignore      .guava-os/manifest.json is gitignored

RESULT: 6/6 passed
```

**Without Linear data:**

```
DOCTOR

  ✓ config         .guava-os/config.json valid
  ✓ agents-md      AGENTS.md present, authority hierarchy found
  ✓ protocol       0/0 process docs found
  ✗ linear         no Linear data provided (caller must pipe issue/label data via stdin)
  ✗ labels         skipped (no Linear data provided)
  ✓ gitignore      .guava-os/manifest.json is gitignored

RESULT: 4/6 passed
```

The `linear` and `labels` failures are expected without stdin. For a quick repo-only check, 4/6 is acceptable. For a full pre-execution check, provide Linear data.
