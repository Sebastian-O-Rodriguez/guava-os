# registry/projects.yml — Schema

The project registry: one file mapping a `projectId` to its repository. guava-os
reads it (`.guava-os/src/registry.ts`; override with
`GUAVA_OS_PROJECT_REGISTRY`).

## Shape

```yaml
projects:
  - id: <string>          # stable lowercase id (matches ^[A-Za-z0-9][A-Za-z0-9._-]*$)
    name: <string>        # human-readable (informational)
    repo_path: <path>     # consumer repo path (~ allowed); must exist
    git_remote: <url>     # canonical git remote (https://github.com/<owner>/<repo>.git)
    linear_project: <string>  # canonical Linear project name (maps to config.linear.project)
    lifecycle: active | paused | retired
    notes: <string>       # free text
```

## Rules

1. `repo_path` must exist on disk.
2. `linear_project` MUST be the exact Linear project name — the registry loader
   uses it to map Linear names to canonical ids.
3. Two entries must not share a `repo_path`.
4. Archived projects: `lifecycle: retired` and `repo_path` moved under
   `~/dev/repos/archive/`. `guava-os work --all` and `doctor` skip `retired`.