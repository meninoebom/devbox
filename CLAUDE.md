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
- **Workbench lab specimen (Postgres):** the Workbench, and only the Workbench, needs a
  disposable Postgres lab. `mise run lab:up` starts it (docker compose, host port **5435**
  to avoid colliding with other local Postgres instances), `lab:reset` re-seeds it (needs
  `down -v` — Postgres init scripts only run on an empty volume). Everything else in DevBox
  stays zero-config SQLite and works with no Docker running. Seed: 5k authors / 500k books,
  no secondary indexes (the index dial is the lesson).

## Development Workflow
- Simple changes: implement directly
- Larger changes: plan first, then implement
- Feature branches, descriptive commits, PRs

## Code Quality
- Write tests when possible
- Run linting/type checks before committing
- Keep commits focused

## Key Patterns
- **Inspector Panel:** Every workshop has an inspector that shows internals.
- **Universal Trace:** A `Trace` (parent) owns ordered `TraceEvent` spans, each on a
  `lane` (http, sql, query_plan now; cache/llm/tool/embedding/memory/loop reserved for
  later phases). Both the tracing middleware and the Workbench write through the
  `TraceStore` service; the Inspector renders events grouped by lane. Event `detail` is a
  schemaless JSON column validated per-lane at the write boundary
  (`schemas/trace.py::validate_detail`). Replaced the old flat `RequestTrace`.
- **Workbench (SQL-first):** paste SQL → `LabRunner` (asyncpg; read-only tx +
  statement_timeout + row cap) runs it against the lab specimen → `PlanParser` normalizes
  EXPLAIN JSON into a plan tree with hot/misestimate highlights → plan graph. Records a
  `workbench_run` trace. Setup DDL (e.g. CREATE INDEX) runs first and persists, so the
  index dial is real.
- **The Mechanic (Phase 3):** a hand-rolled agent loop (no framework; `mechanic.py`
  `step_once`/`run_loop`, prompts in `mechanic_prompts.py`). The ModelClient and the
  tool_runner are FastAPI dependencies, so the gate injects a ScriptedClient + fake
  runner (offline, deterministic) while runtime uses the real Anthropic client and a
  tool_runner whose tools ARE DevBox's own API (in-process ASGI calls, so tool calls
  are traced). Records `agent_run` traces (llm + tool lanes). Stance follows the door
  (direct in Workbench, Socratic elsewhere with a 428 prediction gate). Endpoints:
  `/api/mechanic/ask|hint|step`; UI at `/mechanic` (chat + specimen step mode).
- **Type Bridge:** Pydantic models → OpenAPI → TypeScript types.
- **Workshop Pattern:** Each workshop is self-contained with its own routes, components, and API endpoints.

## The build loop
Phases 2+ are built by an autonomous loop against `docs/design/autonomous-build-spec.md`
(frozen decisions + executable gates), paused at each phase boundary for review.
The gate is `mise run gate` (typecheck + ruff + pytest + smoke); it is hard (green or
halt) and cumulative. Run `mise run lab:up` first (smoke needs the specimen). Add a
key with Doppler to actually talk to the Mechanic; the gate never needs one.

## Design & plan of record
- Full product design (v3, panel-reviewed): `docs/design/one-glass-box.md`.
- Active build plan (plan-one-build-one cadence, no GitHub issues): `.llm/active-plan.md`.
- Session gotchas awaiting promotion: `.llm/raw-learnings.md`.
