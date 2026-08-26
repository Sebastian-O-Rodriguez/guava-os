---
name: terraform
description: "Implement production-grade Terraform infrastructure as code across AWS, Azure, and GCP; use when writing modules, managing remote state, configuring providers, or planning multi-environment applies."
domain: devops
role: task
order: 2
load_when: infrastructure-as-code is in scope
guidance: reuse existing modules | plan before apply | keep state remote

metadata:
  author: guava-os
  version: "0.1.0"
---

## Purpose

Write composable, validated Terraform modules with locked remote state and safe, gated applies.

## Workflow

1. **Analyze** — requirements, existing infra, target cloud providers
2. **Design** — composable modules with clear inputs/outputs
3. **State** — remote backend with locking + encryption (S3/DynamoDB, GCS, Azurerm)
4. **Secure** — least privilege, encryption, no secrets in code
5. **Validate** — `terraform fmt` + `terraform validate` + `tflint`; fix until clean
6. **Plan** — `terraform plan -out=tfplan`; summarize creates/updates/deletes, flag destructive actions
7. **Approve** — present plan, require explicit approval; refuse destructive changes without acceptance; then `terraform apply tfplan`

## Error Recovery

- **Validation fails** — fix reported errors, re-run validate
- **State drift** — `terraform refresh`, or `state rm` / `import` to realign, then re-plan
- **Provider auth** — verify creds/env/provider blocks; `terraform init` if plugins stale
- **Ordering errors** — add explicit `depends_on` or restructure outputs to resolve unknowns

## Module Structure

`main.tf` (resources) + `variables.tf` (typed, with `validation` blocks) + `outputs.tf`. Keep modules small, single-purpose, versioned.

## Constraints

MUST:

- Pin `required_providers` versions and set `required_version`
- Use remote state with locking + encryption (never local for production)
- Validate inputs with `validation` blocks
- Tag all resources; consistent naming
- Run `fmt`/`validate` before every plan

MUST NOT:

- Store secrets in plain text or hardcode env-specific values
- Mix provider versions without constraints
- Create circular module dependencies
- Commit `.terraform/` or state files

## Uses

- Building reusable Terraform modules with versioning
- Migrating/importing state and resolving drift/conflicts
- Configuring AWS / Azure / GCP providers + auth
- Multi-environment and workspace workflows
- Re-validating cleanly before every re-plan

## Source

Distilled from https://github.com/Jeffallan/claude-skills — `skills/terraform-engineer`.