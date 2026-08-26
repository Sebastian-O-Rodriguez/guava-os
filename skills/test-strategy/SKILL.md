---
name: test-strategy
description: "Design a multi-layer testing strategy — unit, integration, E2E, performance, and security — following the test pyramid. Use when planning test coverage, writing tests, designing automation, or auditing coverage gaps and flaky tests."
domain: qa
role: reviewer
order: 4
load_when: test planning is required
guidance: pyramid over single layer | cover the boundary | deterministic, isolated

metadata:
  author: guava-os
  version: "0.1.0"
---

## Purpose

Pick the right test layer per change and ensure each layer asserts real behavior, not implementation details. Default to the pyramid: many fast unit tests, fewer integration tests, fewest E2E tests.

## Test pyramid

```
        ▲  E2E        — few, critical user journeys
       ▲▲  Integration— real components, real DB/API
      ▲▲▲  Unit       — many, fast, isolated logic
```

- **Unit** (most): pure logic, edge cases. Fast, deterministic, mock external deps.
- **Integration** (middle): components wired together; real DB/API where practical.
- **E2E** (fewest): critical paths (registration, checkout, core workflow) through the real UI.
- **Performance & security**: separate, targeted; not in the normal loop.

## Unit testing

- Test happy path + error/edge cases (empty, null, boundary, max).
- Mock external deps — never hit real APIs/DBs/file systems.
- Assert specific outcomes (`expect(result).toBe(90)`), not truthiness; test observable behavior, not internals.
- Use plain-English `it('…')`/`test_…` names that read as a spec.
- Isolate: each test independently runnable; no order dependence; fixtures/factories, never production data.

## Integration testing

- Exercise the real wiring: request → route → service → repository → DB.
- Cover contract edges — validation (400/422), auth (401), not just 201/200 happy paths.
- Seed and clean data per test; use a dedicated test DB.

## E2E testing

Prioritize critical user paths (P0: registration/login/core; P1: payment/settings; P2/P3: edge/admin).

- Drive the real UI (Playwright/Cypress); assert visible outcomes, not selectors.
- Test happy path + validation errors + empty/max states.
- Cover cross-browser/mobile before major releases only.

## Performance testing

Match the question to the test type (k6/Artillery):

| Type | Purpose |
|------|---------|
| Load | normal expected traffic |
| Stress | find the breaking point |
| Spike | sudden traffic surge |
| Soak | long-duration stability |

Set explicit thresholds — `p(95)<500ms`, error `rate<0.01` — and fail CI on breach.

## Security testing

| Category | Tests |
|----------|-------|
| Auth | wrong creds, expired/tampered tokens, rate-limit trigger (429) |
| Authorization | IDOR (other user's resource → 403), privilege escalation |
| Input | reject SQLi (`'; DROP TABLE--`) and XSS payloads |
| Headers | CSP, HSTS, X-Frame-Options present |
| Data | no PII/stack traces in errors |

## Constraints

- Fail on coverage gaps; flag them explicitly rather than padding with trivial tests.
- Treat flakiness as a bug: isolate ordering/async issues and fix; never re-run until green.
- Error paths are mandatory — don't test only the success branch of a try/catch.

## Uses

- Planning test coverage for a feature or repo
- Choosing unit vs integration vs E2E for a specific change
- Adding load/soak/spike or security test suites
- Debugging flaky/order-dependent tests

## Source

Distilled from `Jeffallan/claude-skills` — `test-master` (SKILL.md + `references/unit-testing.md`, `integration-testing.md`, `e2e-testing.md`, `performance-testing.md`, `security-testing.md`).