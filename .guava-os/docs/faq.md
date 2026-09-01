# FAQ

## Why is a missing domain label an error (V400)?

A deliverable without a domain label can't be dispatched to any subagent — dead
weight. Fix: add exactly one domain label (`pm`/`qa`/`security`/`backend`/
`frontend`/`devops`/`ai-ml`).

## Why doesn't the classifier fetch Linear itself?

`doctor`/`status`/`validate`/`next` are deterministic stdin pipes — no network.
`work` and `pm` query Linear.

## What's the difference between `work` and `status`?

`work` queries live Linear and is the session gate (exit 1 = nothing to do).
`status` classifies caller-supplied JSON. Shared signal: "is there executable
work?"

## How do issues go from `Todo` to `Done`?

A project session dispatches a subagent (the issue's domain); the subagent
implements, verifies, commits to `dev/<domain>`, and comments. QA reviews and
merges to `staging`; the operator merges to `production`; the issue moves to
`Done`.

## Why not Linear MCP first?

`gos pm` (the `linear` skill) is the primary, reliable path. Linear MCP
is a fallback when `pm` can't express the operation — MCPs are expensive and
unreliable, so skills and native tools come first.