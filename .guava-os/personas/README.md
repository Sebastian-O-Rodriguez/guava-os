# Personas

Personas are the bridge between the guava-os control plane and OMP workers.
A persona maps a unit of execution responsibility to an **OMP role** and is
dispatched by **Gorp** as a worker through the adapter seam.

## Authority

- guava-os is the control plane: the operator iterates and creates plans here.
- Gorp is the executor: it takes an operator-approved plan and runs it
  (`plan → orchestrate → gate → review → promote`), dispatching workers.
- A **worker** is an OMP agent selected via a persona. Workers execute
  engineering inside an isolated sandbox but never approve or promote
  (operator-only, hash-bound).
- Personas live here, in `.guava-os/personas/<name>/persona.md`.

## File layout

```
.guava-os/personas/
  <name>/
    persona.md
```

One directory per persona. The file is always named `persona.md`.

## `persona.md` format

Frontmatter (YAML):

```yaml
---
name: <persona-name>            # required, matches directory name
description: <one-line summary> # required
maps_to: <omp-role>             # required — an OMP bundled agent:
                                #   scout | designer | reviewer | librarian | task | sonic
                                # (or a model role such as smol when the persona
                                #    targets a fast executor rather than an agent)
model: <omp-model-role>         # optional — smol | default | slow
                                #   hints the model tier Gorp should resolve for the worker
tools: [read, edit, write, bash, grep, glob]  # OMP tools available to the worker in the sandbox
---
```

Body, four required sections in this order:

1. `## Scope` — what this persona owns and is responsible for.
2. `## Patterns` — encouraged approaches and conventions.
3. `## Anti-patterns` — what to avoid and why.
4. `## Tools` — the tool list with usage notes for this persona's work.

## Notes

- Personas do not own governance, approval, or promotion. Those are operator-only.
- Personas do not define project architecture; they specialize an OMP role's
  behavior for a scope of work. Canonical architecture lives in the Gorp docs.
- The deprecated `.claude/agents/{architect,backend,frontend,qa,robo}/` personas
  are replaced by the files in this directory.
