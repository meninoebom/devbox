# DevBox v3 — Enforceable Build Spec (Phases 2–6)

The plan of record for finishing DevBox v3 with an autonomous loop that **cannot
advance on red and cannot silently relitigate a locked decision**. Product design:
`one-glass-box.md`. Phase 0+1 is built and merged; this spec covers 2–6.

## How this prevents a compounding wrong turn

Three mechanisms, in order of strength:

1. **The gate (machine).** After every layer the loop runs `mise run gate`. It is
   green or the loop does not advance. The gate is **cumulative**: every prior
   phase's checks keep running, so a later phase cannot silently break an earlier
   one. Hard mode: typecheck + ruff + ruff format + pytest + HTTP smoke +
   spec-assertions must ALL pass.
2. **Frozen decisions (machine where possible, else declared).** Each phase locks
   a list the loop MAY NOT relitigate. Decisions tagged `[check]` are enforced by
   a gate test; `[review]` ones are enforced by the human checkpoint. If the loop
   comes to believe a frozen decision is wrong, it **HALTS and asks** — it never
   deviates silently.
3. **The human checkpoint (taste).** The loop **stops at every phase boundary**.
   Machine gates catch contract/correctness drift; they do not catch "this
   abstraction is wrong." That is the ~5 stops where you catch what gates can't.

## Loop protocol

- **Unit of work = a layer** (each phase is an ordered list of layers below).
- **Test-first.** A layer writes its gate checks (pytest and/or smoke assertions)
  before or alongside its code. A layer is not done until its own checks exist and
  the whole cumulative gate is green.
- **After each layer:** run `mise run gate`. Red → the loop may self-fix up to **3
  attempts**; still red → **HALT** and surface the failure verbatim.
- **After each phase (all layers green):** **STOP.** Human answers three questions
  (hardest decision, alternatives rejected, least confident) plus one taste check
  ("does this match intent?"). Approve → next phase.
- **Frozen-decision guard:** if the loop wants to violate a `[frozen]` decision, it
  HALTS with its reasoning instead of proceeding.
- **No silent scope cuts:** if a layer drops coverage (skips a check, stubs a
  path), it must `log` it in the layer's summary; a silent stub is a spec violation.

## The gate

`mise run gate` runs, in order (fail-fast):

1. `check:web` — React Router typegen + `tsc` (frontend contract).
2. `check:api` — `ruff check` + `ruff format --check` (backend lint/format). **Hard.**
3. `test:api` — `pytest` (unit + spec-assertion tests under `backend/tests/`).
4. `smoke` — `backend/scripts/smoke.py`: boots the app in-process (httpx ASGI +
   lifespan) and asserts real behavior per phase. Requires the lab specimen up for
   Workbench/agent checks; skips-with-failure if the specimen a phase needs is down.

Every phase EXTENDS `tests/` and `smoke.py`; nothing is ever removed. The baseline
(Phase 0+1 invariants) ships with this spec so the loop starts green.

## Global frozen decisions (apply to every phase)

- `[frozen][check]` SQLite stays the app database; Postgres is only the lab specimen.
- `[frozen][check]` The universal trace (Trace + lane TraceEvent) is the only trace
  model; new observability = a new lane + producer, never a parallel table.
- `[frozen][check]` The assertion engine (Phase 2) is the ONLY pass/fail verifier —
  puzzles, evals, rep benchmarks, and case-file receipts all route through it.
- `[frozen][review]` No authored curriculum. New learning content = generated from
  primitives (world × fault family × params), never hand-written lessons.
- `[frozen][review]` No streaks/XP/badges. Progress = cadence + par + calibration.
- `[frozen][review]` The agent loop is hand-rolled on the Claude API; no agent
  framework. "Hand-rolled vs SDK" may later be a dial, not a dependency.
- `[frozen][check]` Reveals are gated on a committed prediction everywhere EXCEPT
  the Workbench worker surface (stance follows the door).

---

## Phase 2 — The judge + the conscience

**Goal:** the two mechanics everything later depends on: a pass/fail assertion
engine and a committed-prediction gate.

**Frozen decisions**
- `[frozen][check]` Assertions are pure functions over a trace/result → `{passed:
  bool, detail}`. No side effects, deterministic.
- `[frozen][check]` A prediction is sealed server-side before the reveal; the reveal
  returns a diff of prediction vs actual. The stored prediction is immutable.
- `[frozen][check]` Calibration records store (predicted, confidence, actual); they
  are never scored as points (mirror, not scoreboard).

**Layers**
1. Assertion engine: a small DSL/target model + evaluator + `AssertionResult`.
   Assertions target trace fields (`sql.count`, `http.p95`, plan node types).
2. Prediction store: `Prediction` model (sealed value, confidence, target),
   `POST /api/predictions` (seal), reveal endpoint returning the diff.
3. Calibration record: append-only log + a read model (per-field error).
4. The Wager (first consumer): endpoint that seals a slate, then reveals + scores
   calibration (not win/lose).
5. Workbench "call it" chip: optional pre-run prediction of query count / plan
   type; feeds calibration; never blocks a worker run.

**Gate (Phase 2 adds)**
- `pytest`: assertion evaluator truth table (passing + failing cases); a sealed
  prediction cannot be mutated after seal (raises); calibration record round-trips.
- `smoke`: seal a prediction → reveal returns a correct diff; a Wager slate scores
  calibration; the Workbench run still works with and without a "call it".
- `[check]` grep-guard test: no endpoint returns a pass/fail verdict except through
  the assertion engine (enforces the global "only verifier" decision).

---

## Phase 3 — The Mechanic

**Goal:** a resident agent, hand-rolled, tools = the app's own traced API, that is
directly-answering in the Workbench and Socratic elsewhere.

**Frozen decisions**
- `[frozen][check]` The loop is ≤ ~150 lines, no agent framework import.
- `[frozen][check]` Every Mechanic tool call goes through the app's HTTP/traced
  layer and appears on the `tool`/`llm` lanes.
- `[frozen][check]` Outside the Workbench, the Mechanic will not emit a final answer
  until the user has committed a prediction (uses Phase 2's gate).
- `[frozen][review]` The system prompt carries Brandon's explanation contract verbatim.

**Layers**
1. The loop: message array, model call, tool dispatch, stop condition; `llm` +
   `tool` lanes recorded via TraceStore.
2. Three tools (`query_db`, `call_api`, `read_source`) over the traced API.
3. Stance switch: direct in Workbench context, Socratic elsewhere; "just tell me"
   logs as an assist.
4. Hint tiers (point-a-lane → question → halve-space → walk-the-method-minus-one).
5. Prediction-gated specimen mode: step the loop; predict the next step before it runs.

**Gate (Phase 3 adds)**
- `pytest`: loop terminates on no-tool-use; tool results append correctly; a
  non-Workbench answer is blocked without a committed prediction; no framework import
  (import-guard test).
- `smoke`: ask the Mechanic a Workbench question → it answers directly and its tool
  calls appear on the trace lanes; a training-door question first demands a prediction.

---

## Phase 4 — The Rounds (data floor)

**Goal:** generated data-floor puzzles verified by assertions, scored by par.

**Frozen decisions**
- `[frozen][check]` Every puzzle instance is generated (world × fault family ×
  params); zero hand-authored levels. A win check is an assertion.
- `[frozen][check]` Par is computed by the generator (it knows the fix); score is
  delta-from-par on named axes, never XP.
- `[frozen][check]` Cadence = lifetime reps (monotonic) + trailing-14-day rate; no
  consecutive-day counter exists in the schema.

**Layers**
1. World seeder: stand up a domain schema + fake data on demand in the lab.
2. Data fault taxonomy: parameterized injectors (N+1, missing index, fan-out, …),
   each with a known lane signature and known optimal fix.
3. Formats: Regression, Target, Silhouette (generate → play → assertion win check).
4. Par + ghosts: reference-solution generator; delta-from-par on axes; past-self ghost.
5. Cadence + replay tray + retired-family ledger (retire only on unaided near-par +
   correct prior prediction).

**Gate (Phase 4 adds)**
- `pytest`: each fault injector actually produces its signature (assert on the
  generated trace); the matching optimal fix flips the win assertion green; a masking
  fix does NOT; par is computed and finite; no consecutive-day field exists (schema test).
- `smoke`: generate a Regression instance → apply the par fix → win assertion green.

---

## Phase 5 — Gym + Bench + case files

**Goal:** deliberate practice against live software; owned, benchmarked artifacts;
real questions worked in seeded worlds.

**Frozen decisions**
- `[frozen][check]` The rep gate is preserved: a Big-O/hypothesis prediction is
  mechanically required before the reveal (ports `rep.py`'s discipline).
- `[frozen][check]` Rep logs still append to the homebase-log path; the path is config,
  unchanged.
- `[frozen][check]` A pluggable slot benchmarks the user impl against the library impl
  through the same trace/assertion machinery.
- `[frozen][review]` Case files enforce the two-context rule (solve, then re-seed the
  principle in a different world and port).

**Layers**
1. Rep protocol port: phases + the gated prediction + homebase-log writer.
2. Heavy-bag variant (predict → build-alone → reflect only).
3. Pluggable slots: register a user impl (CacheBackend first), live benchmark vs library.
4. The Bench: persistent versioned library; dusty-decay signal (ambient, no nag).
5. Case files: intake, world seeding, two-context rule, explain-back exit.

**Gate (Phase 5 adds)**
- `pytest`: the rep gate blocks advancement without a committed prediction; homebase-log
  path is honored; a registered slot runs and is benchmarked; dusty-decay is derived,
  not a streak.
- `smoke`: register a trivial CacheBackend → it is benchmarked against the library one
  and both traces are recorded.

---

## Phase 6 — The agent floor

**Goal:** applied agent literacy via generated agent puzzles; memory + embeddings.

**Frozen decisions**
- `[frozen][check]` Embeddings sit behind a two-method interface with a toy
  deterministic backend (offline) and a real backend, switchable; sqlite-vec for store.
- `[frozen][check]` Agent evals are assertions (Phase 2 engine); held-out eval sets are
  hidden from the player and enforced (overfitting is punished by the gate, not honor).
- `[frozen][check]` Ablation/Tripwire/Attribution win checks are assertions; generated,
  not authored.

**Layers**
1. Agent fault taxonomy (context bloat, retrieval miss, tool thrash, …) + injectors.
2. Memory (SQLite) + embeddings interface (toy ↔ real) + sqlite-vec store.
3. Formats: Ablation, Tripwire, Attribution.
4. Held-out eval machinery.

**Gate (Phase 6 adds)**
- `pytest`: toy embedder is deterministic; retrieval-miss injector actually drops the
  gold chunk from top-k; an Ablation that fails a held-out eval is rejected; Tripwire
  precision/recall computed on a held-out variant set.
- `smoke`: seed an agent world → Attribution instance → bisection identifies the injected
  fault layer.

---

## Definition of Done (whole spec)

`mise run gate` green with every phase's checks present; each phase reviewed and
approved at its boundary; no `[frozen]` decision violated; `one-glass-box.md`
unchanged (this spec implements it, it does not redesign it). If implementation
reveals a frozen decision is wrong, the loop HALTS and it becomes a human decision,
logged here.
