---
name: security-review
description: "Read-only, evidence-backed security audit of a diff or repository — SAST-style manual review covering auth, input handling, crypto, secrets, and dependencies. Use when asked to review code for vulnerabilities, audit a PR/repo for security, or produce a prioritized findings report. Dispatched under the `security-reviewer` agent type."
domain: security
role: security-reviewer
order: 2
load_when: a security audit is required
guidance: evidence per finding | cite file+line | severity + fix

metadata:
  author: guava-os
  version: "0.1.0"
---

## Purpose

Find real, exploitable vulnerabilities in a diff or repo and report them with location, impact, and remediation. Tools miss context — manual review is mandatory. Read-only: never modify code under review.

## Workflow

1. **Scope** — map the attack surface: entry points (routes, handlers, CLI), trust boundaries, and what each accepts.
2. **Scan** — run automated tools for signal, not verdict:
   - `semgrep --config=auto .`
   - `bandit -r ./src` (Python) / `gosec ./...` (Go)
   - `gitleaks detect --source=.` / `trufflehog`
   - `npm audit` / `trivy fs .` (deps + IaC)
3. **Review manually** — read auth, input handling, crypto, and access-control paths line by line. This is the primary phase.
4. **Classify** — confirm each finding, rate severity (Critical/High/Medium/Low) aligned to CVSS, note CWE/OWASP mapping. No PoC beyond what proves the finding.
5. **Report** — findings table + detailed entries with remediation; prioritize by severity.

## What to look for

| Category | Check |
|----------|-------|
| Auth | Missing/weak auth; token tamper/expiry; user-existence leaks; weak hashing (MD5/SHA-1/unsalted) |
| Authorization | IDOR (lookup by id without ownership check); missing role checks; horizontal/vertical escalation |
| Injection | String-interpolated SQL; `eval`/`exec`/shell with input; unsafe deserialization (`pickle`) |
| XSS | Raw `innerHTML`/`dangerouslySetInnerHTML`/`document.write`; missing output encoding or CSP |
| Path traversal | `path.join` with user filename; missing `basename`/root-prefix check |
| SSRF | Server-side fetch of user-supplied URL; no scheme/host allowlist; no DNS-rebind guard |
| Secrets | Hardcoded keys/tokens/creds; secrets in logs or error output |
| Crypto | ECB mode, static IV, `Math.random` for secrets, weak cipher suites |
| Headers/CORS | Missing CSP/HSTS/X-Frame-Options; permissive `Access-Control-Allow-Origin: *` with credentials |
| Dependencies | Known-vulnerable versions; unpinned/wide ranges |

## Constraints

- Cite exact `file:line` for every finding — never vague.
- Always give a concrete remediation, not just "fix it" — show the secure call.
- Report Critical/High immediately; don't drop Low findings just to shorten the report.
- Don't assume a framework "handles it" — verify the framework's default is actually on.
- Read-only: do not edit code; do not run active exploitation against systems you don't own.

## Finding format

```
ID: FIND-001 — High (CVSS 8.1)
Title: SQL injection in user search
File: src/api/users.py:42
Impact: attacker can read/modify/delete rows
Fix: parameterize → cursor.execute("SELECT … WHERE name=%s", (name,))
Refs: CWE-89, OWASP A03
```

## Uses

- Security review of a PR, branch, or whole repo
- SAST triage and confirming tool-reported findings
- Dependency/secrets audits
- Pre-merge security gates

## Source

Distilled from `Jeffallan/claude-skills` — `security-reviewer` (SKILL.md + `references/vulnerability-patterns.md`).