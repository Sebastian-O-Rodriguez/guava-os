---
name: secure-coding
description: "Write secure code and avoid common vulnerabilities — injection, broken auth, XSS/CSRF, SSRF, secrets handling, and access control. Use when implementing authentication, input validation, encryption, or any OWASP Top 10-sensitive code path."
domain: security
role: security-reviewer
order: 1
load_when: security-sensitive code is in scope
guidance: validate input at the boundary | no secrets in code | least privilege

metadata:
  author: guava-os
  version: "0.1.0"
---

## Purpose

Guide writing code that resists the OWASP Top 10. Apply whenever the change touches user input, auth, secrets, outbound requests, or data at rest/transit.

## Workflow

1. **Threat model** — identify the attack surface and what an attacker controls.
2. **Design** — pick controls before coding (defense in depth).
3. **Implement** — follow the MUST/MUST-NOT rules below.
4. **Validate** — test controls with the checkpoints at the end.

## Injection

- Parameterize every SQL query; never string-interpolate user input. `db.query('… WHERE id = $1', [id])` or an ORM.
- Never build shell commands from input. Prefer `execFile`/`spawn` with arg arrays over `exec(string)`; allowlist commands.
- For deserialization, use JSON (`JSON.parse`/`json.loads`), never `eval` or `pickle.loads` on untrusted input.

## Authentication & sessions

- Hash passwords with bcrypt/argon2 (cost ≥ 12). Never MD5/SHA-1/unsalted.
- Rate-limit auth endpoints and lock accounts after repeated failures.
- Issue short-lived, scoped tokens; allowlist the algorithm (`HS256`) and set `issuer`/`audience`.
- Return the same generic error for "no such user" and "wrong password" — never leak account existence.
- Cookies: `httpOnly`, `secure`, `sameSite: 'strict'`.

## Authorization & access control

- Deny by default; enforce server-side on every handler, never rely on hidden client state.
- Check ownership, not just identity: filter by `userId`/tenant in the query (IDOR defense).
- Verify role for privileged routes; test horizontal AND vertical escalation paths.

## Secrets

- Secrets live in env vars or a secret manager — never in source, config committed to git, or logs.
- Redact sensitive fields in logs and error responses; return generic 500s, never stack traces with internals.

## XSS / CSRF / SSRF

- **XSS**: output-encode. Use `textContent`, React auto-escaping, or DOMPurify for HTML; never `innerHTML`/`dangerouslySetInnerHTML` with raw input. Set CSP.
- **CSRF**: require a token on state-changing requests; use `sameSite` cookies.
- **SSRF**: validate any URL the server fetches. Allowlist schemes (`http`/`https`) and hosts; block internal addresses (`127.0.0.0/8`, `169.254.169.254`, `::1`, RFC 1918); resolve DNS and re-check the resolved IP against the allowlist.

## Validate

After implementing, confirm:

- SQL injection payloads (`' OR 1=1--`) and XSS (`<script>`) are rejected/escaped.
- Brute-force lockout/rate limit triggers; tokens reject tamper/expiry.
- Security headers present (CSP, HSTS, X-Frame-Options, nosniff) and CORS allowlist correct.

## Uses

- Implementing login, JWT/OAuth, or session handling
- Adding input validation or parameterized queries
- Writing any handler that touches user-supplied data, files, shells, or outbound URLs
- Hardening an existing endpoint against a reported vulnerability

## Source

Distilled from `Jeffallan/claude-skills` — `secure-code-guardian` (SKILL.md + `references/owasp-prevention.md`).