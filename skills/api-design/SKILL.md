---
name: api-design
description: "Use to design HTTP APIs (REST + OpenAPI 3.1) or GraphQL schemas and resolvers. Covers resource modeling, versioning, pagination, error contracts, and GraphQL DataLoader/federation patterns."
domain: backend
role: task
order: 1
load_when: deeper API semantics are required
guidance: preserve existing API conventions | use existing error format | avoid unrelated API changes

metadata:
  author: guava-os
  version: "0.1.0"
---

## Purpose

Design contracts that clients can consume and evolve safely: REST-first with OpenAPI 3.1, or GraphQL when clients need flexible shapes across a graph of types.

## Choose REST vs GraphQL

| Need | Choice |
|------|--------|
| CRUD, caching, simple clients, HTTP semantics | REST + OpenAPI |
| Client-driven shapes, many joined types, real-time | GraphQL |

## REST Design Rules

- Resource nouns, not verbs: `/users/{id}` and `POST /users`, never `/getUser`.
- Pick one naming convention (snake_case or camelCase) — apply everywhere, response and query params.
- Full HTTP semantics: `201` for create, `204` for no-content, `409` for conflict, `429` for rate-limit.
- Paginate **every** collection; prefer cursor/keyset for large sets, offset for small/simple.
- Errors: RFC 7807 Problem Details (`application/problem+json`) — stable `type` URI, `title`, `status`, actionable `detail`; `errors[]` for field-level failures.
- Version with a strategy before you ship: URI or header; deprecate explicitly (`Deprecation`/`Sunset` headers); never break without a migration path.
- Document auth/z in the spec; include request/response examples for at least happy + error paths.
- Never expose implementation detail (ORM fields, internal ids) in the API surface.

### Error response shape

```yaml
type: object
required: [type, title, status]
properties:
  type:     { type: string, format: uri }          # stable, documented
  title:    { type: string }
  status:   { type: integer }
  detail:   { type: string }                       # human-readable, actionable
  instance: { type: string, format: uri }
```

## OpenAPI 3.1

- Use OpenAPI `3.1.0` (not 3.0): `nullable` → `type: [t, "null"]` unions.
- Centralize reusable schemas/responses in `components`; `$ref` instead of duplication.
- Validate the spec (`@redocly/cli lint`) and mock (`@stoplight/prism-cli mock`) before promising the contract.
- `format` for scalars (`uuid`, `email`, `date-time`); `operationId` on every operation.

## GraphQL Rules

- Schema-first: design SDL types/interfaces/unions before resolver code.
- camelCase everywhere; `ID!` for identifiers; non-null (`!`) only where the field is *always* present — nullable (`T`) for anything that can fail or defer.
- Never return null for a declared non-null field — resolve errors per-field, not global 500s.
- Kill N+1 with `DataLoader`: one instance per request, batch by `id IN (...)`, return in the **same order** as input keys.
- Limit abuse: query depth + complexity analysis (`maximumComplexity`), pagination (`first`/`after`) on list fields.
- Auth at the field level via context; never pass auth state through resolver args.
- Document types/fields; provide example queries for every operation.

### DataLoader (per-request batching)

```js
user: new DataLoader(async (ids) => {
  const rows = await db.users.findMany({ where: { id: { in: ids } } });
  return ids.map((id) => rows.find((r) => r.id === id) ?? null);  // preserve order
})
```

### Federation essentials (Apollo 2.5+)

- `type Product @key(fields: "id")` owns its fields; extending subgraphs mark foreign fields `@external`.
- `@shareable` on types/fields multiple subgraphs resolve; compose with `rover` and confirm every `@key` resolves before deploy.

## Uses

- Designing a new REST/GraphQL API or OpenAPI spec
- Reviewing an existing API contract for consistency and evolution safety
- Pagination, error-catalog, versioning, or federation design work

## Source

Jeffallan/claude-skills — distilled from skills: api-designer, graphql-architect.