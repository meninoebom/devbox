# DevBox

**Learn how web apps work by inspecting one from the inside.**

You know how mechanics learn engines by taking them apart? DevBox is a full-stack web app that was built to be taken apart. Every HTTP request is recorded. Every SQL query is visible. Every type transformation -- from Python dataclass to JSON to TypeScript object to rendered pixel -- can be watched in real time.

This is not a tutorial with code snippets. This is a running application with an x-ray machine bolted to it.

```
┌─────────────────────────────────────────────────────────┐
│  React + Remix                                          │
│  ┌───────────────────────┐  ┌────────────────────────┐  │
│  │   Workshop UI         │  │   Inspector Panel       │  │
│  │                       │  │                         │  │
│  │   Build a request.    │  │   ▸ Request headers     │  │
│  │   Send it.            │  │   ▸ Response body       │  │
│  │   See what happens.   │  │   ▸ SQL queries (2)     │  │
│  │                       │  │   ▸ Timeline: 12ms      │  │
│  └───────────┬───────────┘  │   ▸ Type schemas        │  │
│              │ fetch()      └────────────────────────┘  │
├──────────────┼──────────────────────────────────────────┤
│  HTTP        │  ← X-Trace-Id header links every        │
│              │     response back to its full trace      │
├──────────────┼──────────────────────────────────────────┤
│  FastAPI     │                                          │
│  ┌───────────▼───────────┐                              │
│  │  Tracing Middleware    │ ← intercepts everything     │
│  │  Routers / Endpoints  │                              │
│  │  Pydantic validation  │                              │
│  └───────────┬───────────┘                              │
│              │                                          │
│  SQLAlchemy + SQLite                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

You need Python 3.12+ and Node.js 18+.

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

**Frontend** (separate terminal):
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Click any workshop. Click any button. Then open the Inspector.

The database is SQLite -- zero config. It auto-creates on first boot. If something gets weird, delete `devbox.db` and restart.

---

## Why This Exists

Most people learn web development by reading about it: "An HTTP request has headers and a body." Cool. What does that actually look like? What headers does your browser send that you never asked for? What does `Content-Type: application/x-www-form-urlencoded` look like on the wire vs `multipart/form-data`? What SQL does an ORM actually generate?

DevBox makes the invisible visible. Every API call you make flows through a tracing middleware that records the full request, the full response, every SQL query, and the timing. That trace is stored in the database and displayed in the Inspector panel -- a slide-out pane that shows you the guts of what just happened.

The difference between reading "the server returns a 422 with validation errors" and *seeing* the exact Pydantic error response with field names, error types, and your bad input reflected back at you -- that's the difference between knowing something and understanding it.

---

## The Workshops

DevBox has 8 workshops, organized in three phases. They build on each other, but each one stands alone.

### Phase 1: Foundations

**HTTP Observatory** -- The transport layer. Build HTTP requests by hand: pick a method, set headers, write a body, hit send. The echo endpoint mirrors back exactly what the server received, so you can see what your browser actually sent (spoiler: more headers than you wrote). Explore status codes by triggering each one. Test content negotiation by changing the `Accept` header and watching the same endpoint return JSON, HTML, XML, or plain text. Slow down a response with a slider and watch the timing in the Inspector.

**Type Bridge** -- The contract between languages. See Pydantic models and their JSON Schema side by side. Send malformed data and watch validation errors explain exactly what went wrong. Play with query parameter coercion -- send `?active=yes` and watch FastAPI turn it into a Python `bool`. Compare how the same entity looks as a SQLAlchemy model (persistence) vs a Pydantic schema (validation).

**Form Workshop** -- Encoding matters. Submit the same data three ways: JSON body, URL-encoded form, and multipart. The Inspector shows you the raw request body for each, so you can see how `name=alice&age=30` differs from `{"name": "alice", "age": 30}` differs from a multipart boundary block. Upload a file and watch multipart construction happen.

### Phase 2: Data Flow

**Data Pipeline** -- The full lifecycle. CRUD operations on messages with a visual showing every transformation step: SQLAlchemy model to Python dict to Pydantic validation to JSON serialization to HTTP response to `fetch()` to `JSON.parse` to TypeScript object to React component. Each step is real and inspectable.

**Response Unwrapper** -- What happens between `return data` in Python and rendered JSX? This workshop traces a response through every transformation: Python object, `model_dump()`, JSON string, bytes on the wire, `fetch()` Response, `.json()`, TypeScript object. Not a diagram -- the actual data at each step.

**Schema Forge** -- The persistence layer. Browse database models, see their SQLAlchemy definitions alongside the raw `CREATE TABLE` SQL, and understand how Pydantic schemas map to database tables. Visual ER diagrams of model relationships.

### Phase 3: Security & Design

**Authentication Lab** -- Register a user, log in, get a JWT. The token is decoded right there in three color-coded sections: red header, purple payload, blue signature. Then try Tamper Mode: edit the payload, re-encode the token, send it to the `/me` endpoint, and watch the server reject it because the signature no longer matches. That's not a lecture on JWT security -- that's a visceral demonstration.

**API Design Studio** -- Explore the messages API as a case study in REST design. See every endpoint with its method, path, request schema, and response schema. Trigger different error types (404, 422, 500) and see the consistent error format. Understand why the API is shaped the way it is.

---

## The Inspector

The Inspector is the heart of DevBox. It's a slide-out panel available on every page, and it shows you the full trace of the last API call you made.

**Five tabs:**

| Tab | What it shows |
|-----|---------------|
| **Request** | Method, URL, every header, the request body |
| **Response** | Status code (color-coded), response headers, response body |
| **SQL** | Every database query that ran during the request, with timing and parameters |
| **Timeline** | Visual bar showing request duration |
| **Types** | Pydantic schema and TypeScript type side by side |

**How it works under the hood:**

1. Every request passes through `TracingMiddleware` in the FastAPI backend
2. The middleware captures: method, path, headers, body, SQL queries (via a context variable), response status/headers/body, and wall-clock duration
3. All of this is stored as a `RequestTrace` row in SQLite
4. The response gets an `X-Trace-Id` header injected
5. The frontend API client reads `X-Trace-Id` from every response
6. The Inspector fetches the full trace from `/api/traces/{id}` and displays it

The trace endpoints themselves are excluded from tracing to avoid infinite recursion.

---

## The Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + Remix | File-based routing, server/client rendering, modern React patterns |
| UI | Tailwind CSS + shadcn/ui | Composable components, easy to customize, no CSS-in-JS runtime |
| Icons | Lucide React | Consistent, tree-shakeable icon set |
| Backend | FastAPI | Async Python, automatic OpenAPI docs, Pydantic integration |
| ORM | SQLAlchemy 2.0 (async) | Industry-standard Python ORM, async session support |
| Validation | Pydantic v2 | Type coercion, JSON Schema generation, FastAPI's native validation |
| Auth | PyJWT + passlib/bcrypt | Standard JWT implementation, bcrypt password hashing |
| Database | SQLite via aiosqlite | Zero configuration, single file, perfect for a teaching tool |

The aesthetic is intentionally industrial: dark backgrounds (`#0f0f0f`), amber accents, monospace fonts (JetBrains Mono), visible borders instead of shadows. The UI looks like exposed infrastructure because that's the point -- nothing is hidden.

---

## The Meta Endpoints

DevBox can describe itself. The `/api/meta` routes let the app inspect its own internals:

- **`/api/meta/source/{path}`** -- Returns the actual Python source code of any module in the app. Sandboxed to the `app/` directory.
- **`/api/meta/routes`** -- Lists every registered API route with methods, parameters, and summaries. The same data that drives the OpenAPI spec.
- **`/api/meta/models`** -- Returns all SQLAlchemy model definitions with column types, nullability, and primary keys.

This means the frontend can show you the backend source code that powers the endpoint you just called. The app teaches you about itself.

---

## Project Structure

```
devbox/
├── backend/
│   ├── app/
│   │   ├── main.py              # App factory, middleware, router wiring
│   │   ├── models/              # SQLAlchemy models (Message, User, Project, RequestTrace)
│   │   ├── schemas/             # Pydantic schemas (create/read/update variants)
│   │   ├── routers/             # API endpoints grouped by domain
│   │   │   ├── messages.py      # CRUD for the Data Pipeline workshop
│   │   │   ├── auth.py          # JWT register/login/inspect for Auth Lab
│   │   │   ├── workshop_http.py # Echo, status codes, delays, content negotiation
│   │   │   ├── workshop_types.py# Schema comparison, validation, type coercion
│   │   │   ├── traces.py        # Inspector panel data source
│   │   │   ├── projects.py      # File upload / multipart for Form Workshop
│   │   │   └── meta.py          # Self-describing source/routes/models endpoints
│   │   └── middleware/
│   │       ├── tracing.py       # The request tracing engine
│   │       └── cors.py          # CORS configuration
│   └── pyproject.toml
├── frontend/
│   ├── app/
│   │   ├── routes/              # One file per workshop + layout + home
│   │   ├── components/
│   │   │   ├── inspector/       # InspectorPanel, InspectorContext, CodeBlock, StatusBadge
│   │   │   ├── layout/          # AppLayout (sidebar + inspector), WorkshopLayout
│   │   │   └── ui/              # shadcn component library
│   │   └── lib/
│   │       └── api.ts           # Typed API client with trace ID capture
│   └── package.json
└── CLAUDE.md
```

---

## Adding a Workshop

Workshops are self-contained. To add one:

**Backend:**
1. Create a new router in `backend/app/routers/workshop_yourname.py`
2. Add endpoints that teach something specific -- think "what would be interesting to inspect?"
3. Register the router in `backend/app/main.py`

**Frontend:**
1. Create `frontend/app/routes/workshops.yourname.tsx`
2. Use `WorkshopLayout` as the wrapper
3. Use `useInspector()` to push traces to the Inspector when users interact
4. Add navigation entries in `frontend/app/components/layout/AppLayout.tsx`

The tracing middleware automatically captures everything. You don't need to instrument your endpoints -- just build them and the Inspector picks them up.

---

## Who This Is For

**Bootcamp students:** You've heard the words "REST API" and "HTTP headers" but they're still abstract. DevBox makes them concrete. Send a POST request and see every byte that crosses the wire.

**Frontend developers:** You know `fetch()` and `.json()`. But what happens on the other side? How does FastAPI parse your request? What SQL does it run? What does validation actually look like when it fails? Now you can see it.

**Backend developers:** You return Python dicts and hope for the best. But what does the frontend actually receive? How does JSON serialization change your datetime objects? What headers does the browser add to your carefully crafted API call? Now you know.

**Educators:** If you teach web development, this is a lab environment. Students can break things on purpose -- send wrong types, tamper with JWTs, trigger every status code -- and immediately see the consequences in the Inspector.

---

## Development

**Run backend tests:**
```bash
cd backend
source .venv/bin/activate
pytest
```

**Lint backend:**
```bash
ruff check app/
```

**Reset the database:**
```bash
rm devbox.db   # from the backend directory
# Tables auto-create on next startup
```

**API docs:**
FastAPI generates interactive docs at [http://localhost:8000/docs](http://localhost:8000/docs). This is the same OpenAPI spec that could generate TypeScript types.

---

## Philosophy

DevBox is built on one idea: **you understand systems by watching them work, not by reading about them.**

Every design decision serves that principle. The tracing middleware exists so you can see real HTTP. The Inspector exists so you never have to imagine what a response looks like. The workshops are interactive because clicking a button and seeing what happens teaches faster than reading a paragraph about what would happen.

The industrial aesthetic isn't just style -- it's a statement. This is an app with its walls removed. The pipes are showing. The wiring is exposed. That's not a bug, that's the entire product.

Build something. Break something. Inspect everything.
