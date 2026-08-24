# Overview

guava-os is the control plane: it plans and manages Linear across projects, and
orchestrates OMP subagents. It does not implement — project sessions are
**dispatchers** that delegate to subagents.

## The two sessions

1. **Manager** (`~/dev/guava-os`) — plans, scopes, and writes Linear across all
   projects; cleans up stale/blocked work. On open, `guava-os work --all` gates
   the session (nothing → close).
2. **Project dispatcher** (`~/dev/repos/<project>`) — loads *its* project's open
   issues and fans each out to a subagent of the issue's role. On open,
   `guava-os work` gates the session.

## Roles

The seven OMP agent types are the roles: `task`, `reviewer`, `scout`, `designer`,
`sonic`, `librarian`, `security-reviewer`. One issue carries one role label and one domain label.

## Commands

- Classifier (stdin, read-only): `doctor`, `status`, `validate`, `next`.
- Live (Linear): `work` (session gate), `pm` (create/update/link/move/comment/…).
- Bootstrap: `register`.

## Authorization

GitHub owns it — protected branches (`dev/<role>` → `staging` → `production`)
with required review + CI. Workers never merge.