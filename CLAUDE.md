# DevBox - Interactive Engineering Playground

## What This Is
A full-stack web application that teaches how modern web apps work by being one.
Every surface is "peelable" — you can inspect the HTTP, the serialization, the rendering, the types.

## Stack
- **Backend:** FastAPI + SQLAlchemy + Pydantic (Python 3.12+)
- **Frontend:** React + Remix + Tailwind CSS + shadcn/ui (TypeScript)
- **Database:** SQLite (zero-config for dev)

## Project Structure
```
devbox/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── main.py
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── routers/      # API endpoints
│   │   ├── middleware/    # Request tracing, CORS
│   │   └── workshops/    # Workshop-specific logic
│   ├── pyproject.toml
│   └── alembic/
├── frontend/         # Remix application
│   ├── app/
│   │   ├── routes/
│   │   ├── components/
│   │   │   ├── ui/           # shadcn components
│   │   │   └── inspector/    # Inspector panel system
│   │   ├── lib/
│   │   └── workshops/
│   ├── package.json
│   └── tailwind.config.ts
└── shared/           # OpenAPI spec, generated types
```

## Local Dev via mise

devbox is polyglot (FastAPI backend in `backend/` + React Router 7 frontend in `frontend/`), so
`mise.toml` pins both toolchains and orchestrates tasks. See `~/projects/knowledge-base/mise.md`.

```bash
mise install        # node 20, pnpm 10.33, python 3.12, uv
mise run dev        # React Router frontend + FastAPI backend together
mise run check      # typecheck (web) + ruff lint/format (api)
mise run build      # production React Router build
mise tasks ls       # all tasks
```

Notes:
- **Frontend is on pnpm** (version pinned via `packageManager` and `mise.toml [tools]`); backend
  is on uv. The `frontend/Dockerfile` installs `pnpm@10.33.0` and uses `pnpm install
  --frozen-lockfile` across its build stages.
- **Backend dev tools are an optional-deps extra**, so ruff/pytest run via `uv run --extra dev`.
- **Pre-existing backend debt (not from this change):** ruff currently reports findings,
  `uv.lock` drifts on `uv run`, and there are no tests yet. `check:api` surfaces the ruff
  findings honestly; clean these up separately.
- **CI gotcha:** never pipe `mise run check` through `tail` — it masks mise's exit code.

## Development Workflow
- Simple changes: implement directly
- Larger changes: plan first, then implement
- Feature branches, descriptive commits, PRs

## Code Quality
- Write tests when possible
- Run linting/type checks before committing
- Keep commits focused

## Key Patterns
- **Inspector Panel:** Every workshop has an inspector that shows internals
- **Request Tracing:** Middleware captures full request lifecycle for display
- **Type Bridge:** Pydantic models → OpenAPI → TypeScript types
- **Workshop Pattern:** Each workshop is self-contained with its own routes, components, and API endpoints
