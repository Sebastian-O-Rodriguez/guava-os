---
name: sql-postgres
description: "Use to optimize PostgreSQL queries, design indexes, and write complex SQL (window functions, CTEs, JSONB) or migrations. Complements the supabase skills for hosted Postgres specifics."
domain: backend
role: task
order: 3
load_when: query/index/schema decisions require deeper guidance
guidance: follow the existing DB abstraction | inspect the query plan before perf claims | no schema/index changes without evidence

metadata:
  author: guava-os
  version: "0.1.0"
---
## Purpose

Make queries fast and correct: analyze before optimizing, prefer set-based SQL, verify every index gets used. Engine-level SQL/indexing — pair with `supabase` skills for hosted platform, RLS, and CLI.

## Workflow

1. **Analyze** — `EXPLAIN (ANALYZE, BUFFERS)` on real data volumes; find Seq Scans and row-estimate mismatches.
2. **Rewrite** — set-based SQL (CTEs, WINDOW, joins) instead of cursors / correlated subqueries.
3. **Index** — targeted or covering index, verified used.
4. **Maintain** — `ANALYZE` after bulk changes; watch VACUUM/bloat.

## Query Optimization Rules

- Analyze the plan *before* recommending any index; never index speculatively.
- Filter early: push `WHERE` into subqueries/CTEs — the deeper the filter, the less work downstream.
- Set-based over row-by-row: replace correlated subqueries with an aggregation `LEFT JOIN`, `GROUP BY`.
- `EXISTS` for existence checks, never `COUNT(*) > 0`.
- Handle NULLs explicitly in comparisons and aggregations (`COALESCE`, `NULLIF`).
- Never `SELECT *` in production queries; list columns so covering indexes can work.
- Refresh stats (`ANALYZE <table>`) when actual rows ≫ estimated rows.

## Window Functions / CTEs

```sql
-- latest completed order per customer (row_number over partition)
WITH ranked AS (
  SELECT customer_id, order_id, total_amount,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
  FROM orders
  WHERE status = 'completed'
)
SELECT * FROM ranked WHERE rn = 1;
```
- `ROW_NUMBER` / `RANK` / `LAG` / `LEAD` zero self-joins for analytics.
- `SUM(...) OVER (PARTITION BY ... ORDER BY ...)` for running totals.
- In Postgres 12+, CTEs are inlined unless `MATERIALIZED`/`RECURSIVE` — don't assume an optimization fence.

## EXPLAIN Reading

Run `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` and check:
- `Seq Scan` on a large table → add/fix an index.
- `actual rows` ≫ `estimated` → `ANALYZE` to refresh stats.
- `Buffers: read` heavy → missing warm cache or index; `hit` is good.

## Indexing

| Query shape | Index |
|-------------|-------|
| Equality / range on key | B-tree (default) |
| `LIKE '%x%'` / trigram | GIN + `pg_trgm` |
| JSONB containment (`@>`) | GIN |
| geo / full-text | GiST / GIN |
| Large append-only, time-range | BRIN |

- Compound index: equality columns first, order of predicates matters.
- `INCLUDE (col)` for covering indexes that avoid heap fetches.
- Partial index `WHERE status = 'pending'` shrinks size for hot filtered queries.
- Use `CREATE INDEX CONCURRENTLY` in production (no write lock); verify with `EXPLAIN` before *and* after.
- Use `uuid` type for UUIDs (not `text`) and always parameterized/prepared statements.

## Migrations

- One migration = one logical change; never fold multiple concerns into one.
- Idempotent, versionable, reversible where possible; forward-only is legitimate only if documented.
- Big tables: add index concurrently, add column with default via backfill, avoid long `ACCESS EXCLUSIVE` locks.
- Test migration up *and* down on a near-production-size copy.
- High-churn table: run `VACUUM (ANALYZE)` after backfill; tune `autovacuum_vacuum_scale_factor` before disabling anything.

## Maintenance

- Never disable autovacuum globally; tune per-table threshold for high churn.
- Monitor bloat: `pg_stat_user_tables` `n_dead_tup` vs `n_live_tup`.
- Connection pooling (pgBouncer) under concurrency.

## Uses

- Diagnosing a slow query or missing index
- Writing complex SQL (CTEs, window functions, JSONB)
- Reviewing migrations and their locking behavior
- Index design and EXPLAIN verification for Postgres

## Source

Jeffallan/claude-skills — distilled from skills: sql-pro, postgres-pro; complements the installed supabase skills.