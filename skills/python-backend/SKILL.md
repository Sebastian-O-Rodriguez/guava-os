---
name: python-backend
description: "Use when building Python backend services — type-safe Python 3.11+, async FastAPI APIs (Pydantic v2), or Django/DRF apps. Covers type hints, async patterns, ORM query optimization, auth, and tests."
domain: backend
role: task
order: 2
load_when: framework-specific implementation guidance is needed
guidance: match existing FastAPI/Django patterns | reuse existing models and services | add type hints and a test

metadata:
  author: guava-os
  version: "0.1.0"
---

## Purpose

Author correct, type-safe, async-first Python backends. Pick the stack by constraints, and keep each layer's core rules sharp.

## Stack Selection

| Situation | Choice |
|-----------|--------|
| Async API, schema-first, OpenAPI docs needed | FastAPI + Pydantic v2 |
| Batteries-included: admin, ORM, content site | Django + DRF |
| Generic Python module/lib | python-pro patterns only |

## Type Hints (python-pro)

- Annotate every public signature and class attribute (`mypy --strict` must pass).
- Use `X | None` and builtin generics (`dict[str, str]`, `list[int]`) — never `Optional[x]` / `typing.List`.
- Prefer `@dataclass` over manual `__init__`; validate in `__post_init__`, not scattered call sites.
- Use `Protocol` for structural interfaces, `Annotated` for dependency markers.
- Never mutable default args (`[]`, `{}`); use `field(default_factory=...)`.
- Never bare `except:`; never ignore mypy errors by `# type: ignore` without a reason.
- Use `pathlib` over `os.path`; context managers (`with`) for all resources.

## Async Patterns

- `async/await` for all I/O (DB, HTTP, fs); never `time.sleep` / blocking calls inside a coroutine.
- Fan out with `asyncio.gather` (or `asyncio.TaskGroup` on 3.11+) over sequential awaits.
- Use an async client (`httpx.AsyncClient`) and async DB engine (async SQLAlchemy / `aiosqlite`).
- Reuse connections/sessions via lifespan or dependency; don't mint one per request.
- Background work is long-lived (queue/worker), not `asyncio.create_task` you can't observe.

## FastAPI (async APIs)

- Use Pydantic **v2** syntax: `field_validator`, `model_validator`, `model_config` — never `@validator` / `class Config`.
- Set `model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)` on response/schema models.
- Dependency injection via `Annotated[Dep, Depends(...)]` — type-alias it (e.g. `DbDep`) and reuse.
- Separate schema (request/response) from ORM model; never expose the ORM object or hashed password in responses.
- Return explicit status codes; `409 Conflict` for duplicate, `201` for created; correct semantics over convenience.
- Async endpoints use async SQLAlchemy (`select`, `scalar_one_or_none`); never sync DB inside async routes.
- Auth: JWT via `OAuth2PasswordBearer`; `get_current_user` raises `401` on invalid token; secrets from env, never hardcoded.
- Type hints are not optional in FastAPI — they drive validation *and* OpenAPI.

## Django / DRF

- Add `db_index` / `Meta.indexes` for frequently filtered, joined, or ordered fields.
- Kill N+1: `select_related` (FK, one-to-one) and `prefetch_related` (M2M, reverse FK) in `get_queryset`.
- DRF: `ModelSerializer` with field-level `validate_<field>`; read-only derived fields via `source=`; `perform_create` to attach `request.user`.
- Permissions on every endpoint (`IsAuthenticatedOrReadOnly` at minimum); never trust raw user input.
- Secrets via environment variables; `DEBUG=False`, `SECRET_KEY`/DB creds never literals in `settings.py`.
- Parameterize raw SQL (`%s` placeholders) — never string-interpolate user input.

## Tests

- pytest: shared state via `@pytest.fixture`; `tmp_path` for files; `@pytest.mark.parametrize` for boundaries.
- Async: `pytest-asyncio` + `httpx.AsyncClient`; reraise asyncio strict mode (no silent swallows).
- Django: `APITestCase`, `force_authenticate`; assert status codes and one non-trivial body field, not just `200`.
- Mock only I/O boundaries; keep business logic real.

## Uses

- Building or auditing a Python/FastAPI/Django service or API
- Writing type-safe, async-first, test-covered backend code
- Reviewing ORM query patterns, Pydantic schemas, or DRF serializers
- Migrating between stacks (Django→FastAPI or reverse)

## Source

Jeffallan/claude-skills — distilled from skills: python-pro, fastapi-expert, django-expert.