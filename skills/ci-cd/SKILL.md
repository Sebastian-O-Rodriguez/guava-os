---
name: ci-cd
description: "Design and operate CI/CD pipelines, deployment automation, and promotion gates; use when authoring GitHub Actions workflows, containerizing apps, or planning gated production rollouts."
domain: devops
role: task
order: 1
load_when: CI/CD pipeline work is in scope
guidance: reuse existing workflow patterns | keep gates deterministic | test the workflow locally

metadata:
  author: guava-os
  version: "0.1.0"
---

## Purpose

Plan and implement build, package, and deploy automation with explicit promotion gates and rollback.

## Workflow

1. **Assess** — application, environments, deployment requirements
2. **Design** — pipeline stages, triggers, promotion gates
3. **Implement** — workflow files, Dockerfiles, deploy manifests
4. **Validate** — lint configs, run build/tests; confirm no destructive changes
5. **Approve** — production deploys require explicit approval; block on withheld approval
6. **Deploy** — rollout + smoke tests; document rollback before going live

## Pipeline Rules

- Gate promotion on stage verification; never push straight to production.
- Pin artifact versions by git SHA; never tag production `latest`.
- Store secrets in secret managers (GitHub Secrets, Vault); never in code, env files, or CI variables.
- Run container/image scanning in the pipeline (Trivy, Grype).
- Wait for health/readiness probes before marking a deploy complete.
- Prefer GitOps for Kubernetes (ArgoCD, Flux) over imperative `kubectl apply`.

## Deployment Strategies

| Strategy | Use when |
|----------|----------|
| Rolling | default; zero-downtime with N+1 capacity |
| Blue-green | instant rollback; full duplicate environment |
| Canary | gradual traffic shift; route by weight |

## MUST NOT

- Deploy to production without explicit approval
- Skip staging testing
- Omit resource limits in container specs
- Deploy without a documented rollback + verification step

## Uses

- Authoring GitHub Actions / GitLab CI / Jenkins pipelines
- Containerizing apps (Dockerfile, multi-stage builds, compose)
- Configuring Kubernetes deployments, services, ingress, probes
- Defining promotion gates and rollback runbooks
- Setting up release automation, artifacts, feature flags

## Source

Distilled from https://github.com/Jeffallan/claude-skills — `skills/devops-engineer`.