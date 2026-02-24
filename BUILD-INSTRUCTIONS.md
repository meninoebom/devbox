# DevBox Build Instructions

**Run this with:** `claude --dangerously-skip-permissions`

**Working directory:** `/Users/brandon/dev/devbox`

## What's Already Done
- Git repo initialized at `/Users/brandon/dev/devbox` (branch: main)
- Full FastAPI backend built in `backend/app/` — models, schemas, routers, middleware, auth, everything
- `pyproject.toml` with all dependencies
- `CLAUDE.md` with project conventions
- `.gitignore`

## What You Need to Build

### Step 1: Install Backend Dependencies
```bash
cd /Users/brandon/dev/devbox/backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Verify the backend starts:
```bash
cd /Users/brandon/dev/devbox/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```
Fix any import errors until it starts clean. Then kill it.

### Step 2: Scaffold the Remix Frontend
```bash
npx create-remix@latest /Users/brandon/dev/devbox/frontend --template remix-run/remix/templates/vite --no-install --no-git-init
cd /Users/brandon/dev/devbox/frontend
npm install
```

### Step 3: Add Tailwind CSS + shadcn/ui
```bash
cd /Users/brandon/dev/devbox/frontend
npm install -D tailwindcss @tailwindcss/vite
npx shadcn@latest init -d
```

Configure Tailwind in `vite.config.ts` — add the `@tailwindcss/vite` plugin.

Add to `app/app.css`:
```css
@import "tailwindcss";
```

Install shadcn components we'll need:
```bash
npx shadcn@latest add button card tabs badge separator scroll-area code sheet dialog input label textarea select toast
```

### Step 4: Create the Frontend API Client
Create `frontend/app/lib/api.ts`:
- Base URL: `http://localhost:8000`
- A `fetchAPI` wrapper that captures request/response details for the inspector
- Returns both the data AND the trace ID from the `X-Trace-Id` response header
- Typed functions for each endpoint group (messages, auth, projects, traces, workshops)

### Step 5: Create the Inspector Panel Component
This is the CORE UI component. Create `frontend/app/components/inspector/`:

**`InspectorPanel.tsx`** — A slide-out panel (or split-screen right side) that shows:
- **Request tab:** method, URL, headers, body (syntax highlighted)
- **Response tab:** status code (with badge color), headers, body (syntax highlighted)
- **SQL tab:** queries that ran during the request (fetched from the trace)
- **Timeline tab:** visual timeline of the request lifecycle with duration
- **Types tab:** shows the Pydantic schema and TypeScript type side by side

**`InspectorContext.tsx`** — React context that holds the current trace data. Any component can push a trace to it.

**`CodeBlock.tsx`** — Syntax highlighted code display (use a simple CSS approach, no heavy dependency needed)

**`StatusBadge.tsx`** — Color-coded HTTP status code badge (2xx green, 3xx blue, 4xx yellow, 5xx red)

### Step 6: Create the Layout
Create `frontend/app/components/layout/`:

**`AppLayout.tsx`** — The main layout:
- Left sidebar: navigation to each workshop (use icons from lucide-react)
- Main content area
- Inspector panel (toggleable, slides in from right)
- Industrial/exposed-brick aesthetic: dark background (#1a1a1a), warm accent colors, monospace fonts for code, visible grid lines

**`WorkshopLayout.tsx`** — Wrapper for each workshop page:
- Title + description area
- Tabbed sections: "See It" | "Inspect" | "Break It" | "Read About It" | "Challenge"
- Inspector panel integration

### Step 7: Build the Workshop Pages

Each workshop is a Remix route under `app/routes/workshops/`.

#### Workshop 1: HTTP Observatory (`app/routes/workshops.http.tsx`)
- Request builder UI: pick method, enter URL path, add headers, add body
- "Send" button fires the request to the echo endpoint
- Response displayed alongside the request
- Status code explorer: grid of common HTTP status codes, click one to hit `/api/workshop/http/status/{code}` and see the response
- Loading state demo: slider to set delay, fires `/api/workshop/http/slow`, shows loading spinner/skeleton
- Content negotiation: toggle Accept header between application/json, text/html, text/plain — see the response change

#### Workshop 2: The Type Bridge (`app/routes/workshops.types.tsx`)
- Split screen: Pydantic model code on left, TypeScript type on right, JSON schema in middle
- "Send data" form: enter JSON, send it to `/api/workshop/types/validate`, see validation results with coercion details
- Query param playground: input fields for different types, shows how they serialize to the URL and how FastAPI parses them back
- Type mismatch simulator: intentionally send wrong types and see the 422 error detail format

#### Workshop 3: Form Workshop (`app/routes/workshops.forms.tsx`)
- Three forms side by side: JSON body, URL-encoded, multipart
- Each form sends the same data in a different encoding
- Inspector shows the raw request body for each — see the difference in encoding
- File upload section: upload an image, watch the multipart boundary construction in the inspector
- Remix form actions vs fetch: same form submission two ways, compare in inspector

#### Workshop 4: Data Pipeline (`app/routes/workshops.data.tsx`)
- Messages CRUD interface (simple card list with create/edit/delete)
- "Pipeline view": visual showing the data transformation chain: SQLAlchemy model → Python dict → Pydantic validation → JSON serialization → HTTP response → fetch() → JSON.parse → TypeScript object → React component
- Each step in the pipeline is clickable to see the actual data at that point
- Pagination controls with query param demonstration

#### Workshop 5: Authentication Lab (`app/routes/workshops.auth.tsx`)
- Register/Login forms
- After login: shows the JWT decoded in three colored sections (header/payload/signature)
- Token inspector: paste any JWT, see it decoded
- "Tamper" mode: edit the payload, re-encode, send to /me — watch it fail
- Token expiry demo: get a short-lived token, watch countdown, see the 401 when it expires
- Refresh flow visualization

#### Workshop 6: API Design Studio (`app/routes/workshops.api-design.tsx`)
- Interactive REST resource explorer: shows the messages API as an example of good REST design
- For each endpoint: method + path + description + request/response schemas
- Error response explorer: trigger different error types (404, 422, 500) and see consistent error format
- "Design your own endpoint" exercise: pick resource, operations, see the RESTful design generated

#### Workshop 7: Response Unwrapper (`app/routes/workshops.responses.tsx`)
- Visual step-through of a response from Python return to rendered React
- Each transformation step shown: Python object → model_dump() → JSON string → bytes → network → fetch() → Response → .json() → TypeScript object
- Row iteration demo: fetch a list endpoint, show how to iterate the response (for_each, map, etc.)
- Streaming response demo if time allows

#### Workshop 8: Schema Forge (`app/routes/workshops.schema.tsx`)
- Visual ER diagram of the database models (can be simple boxes with lines)
- Model browser: click a model, see its SQLAlchemy definition, Pydantic schema, and the actual CREATE TABLE SQL
- Migration viewer: show what an Alembic migration looks like for adding a column

### Step 8: Home Page (`app/routes/_index.tsx`)
The Lobby:
- Hero section: "DevBox" title with tagline "Lift the hood on how web apps really work"
- Interactive stack diagram: React → Remix → HTTP → FastAPI → SQLAlchemy → SQLite
  Each layer is a clickable card that links to the relevant workshop
- Quick stats: number of workshops, concepts covered
- "Start Exploring" CTA button

### Step 9: Styling & Theme
The aesthetic is **industrial/exposed infrastructure**:
- Dark theme: `#0f0f0f` background, `#1a1a1a` card backgrounds
- Warm accents: amber/orange (`#f59e0b`) for highlights, green for success, red for errors
- Monospace font (JetBrains Mono or similar from Google Fonts) for all code
- Sans-serif (Inter) for body text
- Subtle grid pattern or dot matrix background
- Cards with visible borders, not shadows
- "Pipe" metaphors: connecting lines between components in diagrams

Add global styles to `app/app.css` and configure the shadcn theme in `tailwind.config.ts`.

### Step 10: Wire Up Navigation
The sidebar should have:
- DevBox logo/name at top
- Workshop links grouped by phase:
  - **Foundations:** HTTP Observatory, Type Bridge, Form Workshop
  - **Data Flow:** Data Pipeline, Response Unwrapper, Schema Forge
  - **Security & Design:** Authentication Lab, API Design Studio
- Each link shows an icon and name
- Active state highlighting

### Step 11: Initial Commit
```bash
cd /Users/brandon/dev/devbox
git add -A
git commit -m "Initial DevBox scaffold: FastAPI backend + Remix frontend with workshop structure

Full-stack educational playground with:
- FastAPI backend: models, schemas, routers, request tracing middleware, JWT auth
- Remix frontend: 8 workshop pages, inspector panel, industrial dark theme
- shadcn/ui component library with Tailwind CSS

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

## Design Principles to Follow
- **Show, don't tell.** Every explanation should have a live, working demo next to it.
- **The inspector is king.** Every API call should be inspectable. Use the `X-Trace-Id` header to fetch traces.
- **Industrial aesthetic.** Exposed pipes, visible wiring. Dark, warm, technical.
- **Keep workshops self-contained.** Each one should work independently.
- **Real code, not mockups.** The backend must actually run. The data must actually flow.

## If Things Break
- Backend won't start? Check imports in `app/main.py`. The models, routers, and middleware are all wired there.
- Frontend type errors? We're not generating types from OpenAPI yet — use manual TypeScript interfaces matching the Pydantic schemas in `backend/app/schemas/`.
- Database errors? Delete `devbox.db` and restart — tables auto-create on startup.
