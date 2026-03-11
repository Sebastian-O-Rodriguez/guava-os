# Dev Tooling

## Package Manager

**uv** — fast Python package manager. All commands go through `uv run`.

```bash
uv sync              # Install dependencies
uv sync --all-extras # Install with optional deps (e.g., mcp)
```

## Task Runner

**just** — command runner. Primary interface for all dev tasks.

```bash
just ci          # Full pipeline: lint → typecheck → test → fish-check → security
just test        # Unit tests only (excludes integration)
just test-all    # All tests including integration (requires tmux)
just lint        # Ruff lint check
just fmt         # Ruff auto-format
just typecheck   # mypy --strict
just cov         # Tests with coverage report
just fish-check  # Validate fish template syntax
```

Prefer targeted tests over full suite:
```bash
uv run pytest tests/test_lifecycle.py -x -q
```

## Linting

**ruff** — lint + format. Rules: E, F, I, UP, B, SIM, ASYNC, PERF, RUF, LOG, G, C4, PIE, DTZ, RET, RSE, S.

Line length: 100 chars. Configured in `pyproject.toml`.

## Type Checking

**mypy --strict** — mandatory on all function signatures. No exceptions.

## Test Framework

**pytest** with:
- `pytest-asyncio` for async tests
- `pytest-xdist` for parallel execution (`-n auto`)
- `pytest-cov` for coverage (80% gate)
- Integration tests marked `@pytest.mark.integration` (require tmux)

## Pre-commit Hooks

Enforced on every commit:
- Trailing whitespace, EOF newline
- YAML/TOML validity
- Ruff lint + format
- mypy --strict
- gitlint (conventional commits)

## Conventional Commits

Enforced by gitlint. See `COMMIT_GUIDELINES.md` for full spec.

```
type: lowercase description

feat | fix | docs | style | refactor | perf | test | chore
```

## Environment Setup

```bash
# 1. Clone and install
git clone <repo> && cd shoal
uv sync --all-extras

# 2. Install pre-commit hooks
uv run pre-commit install

# 3. Verify everything works
just ci
```
