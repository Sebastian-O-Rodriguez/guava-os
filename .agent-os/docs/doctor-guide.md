# Doctor Guide

How to read and use `agent-os doctor` output.

## What Doctor Checks

| Check | What It Validates | Requires Stdin |
|-------|------------------|----------------|
| config | `.agent-os/config.json` exists and parses | No |
| claude-md | `CLAUDE.md` exists and contains "Authority Hierarchy" section | No |
| agents | Every persona in config has a matching AGENT.md file | No |
| protocol | All process docs referenced in config exist | No |
| linear | Linear issue data was provided by caller via stdin | Yes |
| labels | Every configured persona has a matching label in Linear data | Yes |
| gitignore | `.agent-os/manifest.json` is in `.gitignore` | No |

## What Doctor Does NOT Check

- Linear network connectivity (the CLI has no network layer)
- Issue graph structure (that's `validate`)
- Execution readiness (that's `status`)
- Code quality or build state
- Git state or branch naming

Doctor validates **local repo and config readiness**. It answers: "Is this repo set up correctly for Agent OS?"

## Stdin Requirements

Without stdin, doctor runs 5 of 7 checks. The `linear` and `labels` checks require data.

**Minimal stdin for full check:**

```bash
echo '{"issues": [], "labels": ["architect", "backend", "frontend", "qa"]}' | .agent-os/bin/agent-os doctor
```

The `issues` array can be empty — doctor only needs it to confirm data was provided. The `labels` array must contain the actual label names from Linear.

## Config Requirements

Doctor validates that `.agent-os/config.json` exists. It does not validate the JSON against the schema (that's a future enhancement). If the file parses as JSON, the check passes.

## CLAUDE.md Requirements

Doctor checks that `CLAUDE.md` exists at the repo root and contains the text "Authority Hierarchy". This confirms the repo follows the Agent OS authority model.

## Persona Label Check

When both `issues` and `labels` are provided in stdin, doctor cross-checks:

- Every label in `config.labels.persona_labels` exists in the Linear labels
- The `config.labels.qa_label` exists in the Linear labels

If a configured persona has no matching Linear label, the check fails and reports which labels are missing.

## Example Output

**Full pass:**

```
DOCTOR

  ✓ config         .agent-os/config.json valid
  ✓ claude-md      CLAUDE.md present, authority hierarchy found
  ✓ agents         4/4 persona AGENT.md files found
  ✓ protocol       3/3 process docs found
  ✓ linear         Guava AI / RoutineMe — issue graph loaded
  ✓ labels         4/4 persona labels found in Linear data
  ✓ gitignore      .agent-os/manifest.json is gitignored

RESULT: 7/7 passed
```

**Without Linear data:**

```
DOCTOR

  ✓ config         .agent-os/config.json valid
  ✓ claude-md      CLAUDE.md present, authority hierarchy found
  ✓ agents         4/4 persona AGENT.md files found
  ✓ protocol       3/3 process docs found
  ✗ linear         no Linear data provided (caller must pipe issue/label data via stdin)
  ✗ labels         skipped (no Linear data provided)
  ✓ gitignore      .agent-os/manifest.json is gitignored

RESULT: 5/7 passed
```

The `linear` and `labels` failures are expected without stdin. For a quick repo-only check, 5/7 is acceptable. For a full pre-execution check, provide Linear data.
