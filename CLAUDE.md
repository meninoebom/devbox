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
