# registry/projects.yml — Schema

The project registry: the one file mapping a `projectId` to its repository.
Execution state stores projectId only; the control plane resolves the path
here at command time (`runtime/control/src/registry/projects.ts`; override
with `GORP_PROJECT_REGISTRY`). An unregistered project fails closed
(`PROJECT_NOT_REGISTERED`, exit 20).

## Shape

```yaml
projects:
  - id: <string>          # stable lowercase id (matches ^[A-Za-z0-9][A-Za-z0-9._-]*$)
    name: <string>        # human-readable (informational)
    repo_path: <path>     # path to the consumer repo (~ allowed); must exist
    lifecycle: active | paused | retired   # informational
    notes: <string>       # free text (informational)
```

Only `id` and `repo_path` are read by the runtime. The parser is a
conservative line-based reader: one `- id:` line per entry followed by its
`repo_path:`; unknown keys are ignored.

Rules:

1. `repo_path` must exist on disk at command time.
2. Two entries must not share a `repo_path` (sandbox branch names are keyed by
   graph/node/run, not project — duplicate paths would collide).
3. Moving a repository rebinds all of that project's historical graphs; do it
   deliberately.
