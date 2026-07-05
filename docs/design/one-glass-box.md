# One Glass Box — DevBox consolidation design (v3)

Status: design accepted-pending-Brandon-review, build not started.
Rendered spec (with working demos): Claude artifact "DevBox: One Glass Box"
(https://claude.ai/code/artifact/70729f2a-973f-40f8-aac8-29d0f9830946).
v1 2026-07-04 (initial design) → v2 (case files + plain-language mechanisms) →
v3 2026-07-05 (rebuilt after a three-expert panel review: learning scientist,
dev-ed product analyst, puzzle designer).

## What this is

Consolidation of Brandon's educational tools into ONE tool, built on the existing
DevBox chassis (FastAPI + SQLAlchemy + Pydantic backend, React Router frontend,
tracing middleware + Inspector + meta endpoints already built).

Donors and fates:
- **devbox** — the chassis. The 8 existing workshops persist as reference
  surfaces, not a course.
- **engineering-gym** — donates the 7-phase rep protocol, the rep.py gate, and
  the homebase-log convention. Log path stays unchanged (the log outlives
  repos by design). Repo archived after the port. The gym streak is replaced
  by reps + cadence (see below).
- **cleartext-encryption-game** — stays standalone; donates the pedagogy rule
  (scenario first, consequences instead of lectures) and informs a crypto
  fault family.
- **encoding-guide.html, how-context-works.html** — served on the Workbench
  field-guide shelf.

## Panel findings that reshaped the design

1. **Expertise reversal (learning scientist).** Watching a vivid correct
   example is optimal for novices and counterproductive for experts. Brandon's
   "too tutorial-shaped" complaint was this effect, felt. Deepest fix: no
   reveal without a committed prediction; the trace becomes the answer key to
   a question you already answered.
2. **Daily-driver property (dev-ed analyst).** Tools professionals keep for
   years (regex101, PEV2, MDN) sit on the critical path of real work: pull not
   push, zero cost-to-first-answer, learning as a byproduct of getting
   unblocked. Therefore the Workbench ships before any game layer.
3. **Generated, never authored (puzzle designer).** Content = world × fault
   family × randomized parameters. Win states are assertions. Score is
   delta-from-par on orthogonal axes, never XP.
4. **Three-way unprompted refusals:** spaced-repetition card decks
   (review-debt cliff), streaks/XP/badges (extrinsic pressure corrodes
   intrinsic motivation), authored curriculum spines (resented by a
   self-directed expert).

## The engine (one machine under everything)

- **The board — the trace.** Generalize RequestTrace → TraceEvent spans with
  lanes: HTTP, SQL, query plan, cache, LLM, tool, embedding, memory, loop
  step. Progressive disclosure: one germane lane open by default.
- **The judge — assertions.** One small DSL for mechanically checkable
  statements about behavior (`p95 < 20ms`, `sql.count <= 3`, "answer contains
  every deadline within 7 days"). The SAME engine is puzzle win-checker, agent
  eval harness, rep benchmark verdict, and case-file receipt. Binary; no
  partial credit.
- **The conscience — the call.** A sealed prediction (number / plan type /
  suspect layer / Big-O) committed before any reveal in training contexts,
  then diffed against reality. Feeds a lifetime calibration curve. The
  prediction record is a mirror, never a scoreboard (unfudgeable, no points).
- **Supplies:** seedable worlds (any small domain schema + plausible fake
  data, seeded by the agent, disposable, occasionally mutated for carryover)
  and parameterized fault families with known lane signatures and known
  optimal fixes.

Fault families, data floor: N+1 lazy load, missing/unsargable index, join
fan-out, over-fetch, unbounded result, wrong cache key, cache stampede/TTL,
sync-in-async/pool exhaustion, isolation anomaly, denorm drift.
Agent floor: context bloat, retrieval miss, dead tool call, tool thrash,
injection, write-only/stale memory, non-termination, over-summarization,
wrong model tier.

## The stance rule (resolves the panel's one real conflict)

**The tool never quizzes you when you came to work, and never spoon-feeds you
when you came to train.** Workbench = worker: free reveals, Mechanic answers
directly. Every other door = trainee: reveals gated on a committed call,
Mechanic Socratic ("just tell me" exists but logs visibly as an assist). An
optional "call it" chip in the Workbench feeds calibration without gating work.

## Four doors (covering toolbox / gym / game / puzzle / reference)

1. **The Workbench** (toolbox + reference; free reveals). regex101 for the
   whole stack: bring your own query/request/schema/agent config; instant
   trace; visual EXPLAIN; one-click A/B of any dial; trace-diff view. The
   reference layer lives here: field guides, dials as living reference
   entries, and the own-words glossary (re-opening a term prompts
   reconstruct-from-memory first, then diffs against the stored definition).
   Acceptance test: beats psql to first answer, or the retention bet fails.
2. **The Rounds** (game + puzzle; earned reveals). One generated instance a
   day, 5–15 min. Seven formats, interleaved (never same format twice
   running; floors alternate; draw biased toward weakest fault families):
   - **Regression** — green baseline went red, one injected fault; diagnose
     from lanes, repair the cause (masking fixes caught structurally).
   - **Target** — nothing broken, just naive; clear the SLO in ≤K changes;
     decoy levers exist.
   - **The Wager** — sealed reveal; commit a slate of predictions with
     confidence; graded on calibration (Brier-style), not win/lose.
   - **Ablation** — agent passes evals expensively; cut tokens/tool calls to
     budget with zero eval regressions; hidden held-out evals punish
     overfitting.
   - **Tripwire** — YOU author the assertion that separates good variants
     from subtly-broken ones and survives 20 unseen variants (eval design as
     a game; precision/recall made physical).
   - **Silhouette** — trace only, source hidden; reconstruct the architecture
     from the runtime signature.
   - **Attribution** — an agent's answer is wrong; bisect the stacked trace
     (DB → SQL → retrieval → context → model); fix only the guilty layer.
   Scoring: delta-from-par on orthogonal axes (lanes read, changes made,
   residual perf, wall-clock, aid used), vs labeled reference solutions
   (naive/clever/machine-searched optimum) + past-self ghost. Never a fake
   population. Families "retire" with a real certification ("N+1 retired at
   1M rows") only via unaided near-par solves on fresh isomorphs with a
   correct prior call.
3. **The Gym & the Bench** (gym; earned reveals). 7-phase protocol intact
   (gated Big-O prediction, no-AI build phase, homebase-log) + a 5-minute
   heavy-bag variant keeping only predict → build alone → reflect. Reps
   target pluggable slots (CacheBackend, rate limiter, similarity fn,
   retry/backoff, tiny reactive store, DTW distance); hand-built versions are
   registered, benchmarked live, and the trace shows WHY they win or lose.
   The Bench = the persistent versioned library of what he has built; stale
   tools render "dusty" (ambient spaced-practice invitation to re-forge from
   a blank editor).
4. **Case Files** (real work in; earned reveals). Intake from any Claude
   session (one command). Question → seeded world → dials → exit ritual.
   Two panel upgrades: the **two-context rule** (after solving in his domain,
   the same principle is re-seeded in a deliberately different world and he
   predicts-and-ports the fix; one analog welds knowledge to surface
   features) and the exit statement must be domain-independent. Teach-the-
   skeptic recurs later as a spaced 90-second challenge; exposed
   misconceptions become future review items.

## The Mechanic (resident agent)

Hand-rolled Claude API loop (~80 lines; the loop IS Floor-3 curriculum; later
"hand-rolled vs Agent SDK" becomes a dial). Tools = the app's own traced API.
Stance follows the door. System prompt carries Brandon's explanation contract
verbatim (answer first, define before use, numbered steps, plain words).
Specimen mode is prediction-gated (predict what the next loop step / an edit
to the messages array will do, then step). Hint economy: 4 tiers that teach
the diagnostic move, never the answer (point a lane → diagnostic question →
halve hypothesis space → walk the method minus the last move); aid disclosed,
never charged. Give-up = narrated trace-walk replay + immediate sibling
instance of the same family. No praise, no confetti, ever.

## Return-without-guilt (replaces streaks)

1. Workbench earns visits from real work; everything else rides along.
2. Relevance-triggered prep: "about to add caching to Ralf" surfaces prior
   caching learning as sharpening, not review debt.
3. Quiet pulls: lifetime calibration curve; replay tray (solved-but-off-par);
   retired-family ledger; dusty Bench tools; one skippable 60-second Wager
   per visit.
4. Cadence not streaks: lifetime reps (monotonic) + trailing-14-day cadence
   (self-recovering, no reset cliff). Missed week → gentle re-entry Wager +
   re-verify one retired family.

## Engineering decisions

- Chassis = devbox. SQLite stays the app DB; Postgres is a lab specimen via
  optional docker compose (only the Query Lab needs it).
- Embeddings: sqlite-vec behind a 2-line interface; toy deterministic
  embedder ↔ real provider as a dial.
- No new authored curriculum ever; floors are a map, not a ladder; nothing
  unlocks.
- Plain words as mechanism: contract in the system prompt; explain-back exit;
  reconstruct-first glossary.

## Roadmap (each phase ships something usable; building it teaches its topic)

0. **Shelf & bench** (an afternoon): /guides, links, home bench stub.
1. **Universal trace + Workbench**: lanes w/ progressive disclosure, BYO
   query/schema, visual EXPLAIN, Postgres specimen, dials, trace diff.
   Acceptance test: faster than psql to first answer.
2. **Judge + conscience**: assertion engine, sealed predictions + reveal
   diff, calibration record, the Wager, Workbench "call it" chips.
3. **The Mechanic**: loop, tools, LLM/tool lanes, both stances, hint tiers,
   gated specimen, explanation contract.
4. **The Rounds (data floor)**: world seeder, data fault taxonomy,
   Regression/Target/Silhouette, par + ghosts, cadence, replay tray, ledger.
5. **Gym + Bench + case files**: protocol port (log path unchanged),
   heavy-bag, slots + trace-explained benchmarks, dusty decay, two-context
   rule, recurring teach-the-skeptic.
6. **Agent floor**: agent fault taxonomy, Ablation/Tripwire/Attribution,
   memory + embeddings surfaces, held-out evals.
