"""Smoke gate: boot the app in-process and assert real behavior.

Part of `mise run gate`. Exits non-zero on any failed assertion so the loop halts.
The Workbench checks need the lab specimen up (`mise run lab:up`); if it is down,
this fails loudly rather than skipping, because the Workbench is shipped and must
stay verified.

Each phase appends its own checks here; nothing is removed.
"""

import asyncio
import sys

import httpx

from app.main import app


def _node_types(plan) -> list[str]:
    out: list[str] = []

    def walk(n):
        if not n:
            return
        out.append(n.get("node_type"))
        for ch in n.get("children", []):
            walk(ch)

    if plan:
        walk(plan.get("root"))
    return out


class Check:
    def __init__(self):
        self.failures: list[str] = []

    def ok(self, cond: bool, label: str):
        mark = "ok " if cond else "FAIL"
        print(f"  [{mark}] {label}")
        if not cond:
            self.failures.append(label)


async def run() -> int:
    c = Check()
    transport = httpx.ASGITransport(app=app)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # --- Phase 0/1: universal trace records a request as http + sql lanes ---
            print("universal trace:")
            r = await client.get("/api/messages?page=1&limit=3")
            c.ok(r.status_code == 200, "GET /api/messages 200")
            c.ok(r.headers.get("X-Trace-Id") is not None, "response carries X-Trace-Id")

            t = await client.get("/api/traces/latest")
            trace = t.json()
            lanes = [e["lane"] for e in trace["events"]]
            c.ok(trace["kind"] == "request", "latest trace kind == request")
            c.ok("http" in lanes, "trace has an http lane")
            c.ok("sql" in lanes, "trace has at least one sql lane")

            # --- Phase 1: Workbench runs SQL, returns a plan, records a workbench_run ---
            print("workbench:")
            wr = await client.post(
                "/api/workbench/run",
                json={"sql": "SELECT count(*) AS n FROM authors"},
            )
            wd = wr.json()
            if not wd.get("specimen_up", False):
                c.ok(False, "lab specimen reachable (run `mise run lab:up`)")
            else:
                c.ok(wd.get("error") is None, "workbench run has no error")
                c.ok(bool(wd.get("plan")), "workbench returns a plan")
                root = wd.get("plan", {}).get("root", {})
                c.ok(root.get("node_type") is not None, "plan has a root node")
                c.ok(wd.get("trace_id") is not None, "workbench run recorded a trace")

                wt = await client.get(f"/api/traces/{wd['trace_id']}")
                wtj = wt.json()
                wlanes = [e["lane"] for e in wtj["events"]]
                c.ok(wtj["kind"] == "workbench_run", "recorded trace kind == workbench_run")
                c.ok("query_plan" in wlanes, "workbench trace has a query_plan lane")

            # --- Phase 2: assertion engine + prediction/reveal + wager ---
            print("conscience:")
            sp = await client.post("/api/predictions", json={"target": "rows", "predicted": 42})
            pid = sp.json()["id"]
            rv = await client.post(f"/api/predictions/{pid}/reveal", json={"subject": {"rows": 42}})
            c.ok(rv.json().get("correct") is True, "sealed prediction reveals correct diff")
            rv2 = await client.post(
                f"/api/predictions/{pid}/reveal", json={"subject": {"rows": 42}}
            )
            c.ok(rv2.status_code == 409, "second reveal rejected (seal is once-only)")

            wag = await client.post(
                "/api/wager",
                json={
                    "sql": "SELECT id FROM books WHERE author_id = 11",
                    "calls": [
                        {"target": "plan.has_seq_scan", "predicted": True, "confidence": 0.6}
                    ],
                },
            )
            wj = wag.json()
            if not wj.get("specimen_up", False):
                c.ok(False, "wager needs the lab specimen")
            else:
                c.ok(len(wj.get("results", [])) == 1, "wager reveals its slate")
                c.ok("correct" in wj["results"][0], "wager result carries a verdict")

            cal = await client.get("/api/calibration")
            c.ok(len(cal.json()) >= 1, "calibration summary has rows after reveals")

            wc = await client.post(
                "/api/workbench/run",
                json={
                    "sql": "SELECT count(*) AS n FROM authors",
                    "call": {"target": "rows", "predicted": 1},
                },
            )
            c.ok(wc.json().get("call_result") is not None, "workbench run honors a call-it")

            # --- Phase 3: the Mechanic (scripted model, REAL traced tools) ---
            print("mechanic:")
            from app.routers.mechanic import get_model_client
            from app.services.model_client import ModelResponse, ScriptedClient, ToolCall

            def scripted(*responses):
                rs = list(responses)
                return lambda: ScriptedClient(list(rs))

            try:
                # ask: one tool call, then a final answer
                app.dependency_overrides[get_model_client] = scripted(
                    ModelResponse(
                        tool_calls=[
                            ToolCall(
                                id="t1",
                                name="query_db",
                                input={"sql": "SELECT count(*) FROM authors"},
                            )
                        ]
                    ),
                    ModelResponse(text="Authors is a small table; COUNT(*) scans it."),
                )
                ar = await client.post(
                    "/api/mechanic/ask",
                    json={"question": "how big is authors?", "stance": "workbench"},
                )
                aj = ar.json()
                c.ok(
                    ar.status_code == 200 and bool(aj.get("answer")),
                    "mechanic answers a workbench question",
                )
                atj = (await client.get(f"/api/traces/{aj['trace_id']}")).json()
                alanes = [e["lane"] for e in atj["events"]]
                c.ok(atj["kind"] == "agent_run", "mechanic trace kind == agent_run")
                c.ok("llm" in alanes and "tool" in alanes, "mechanic trace has llm + tool lanes")

                # training stance is blocked without a committed prediction
                br = await client.post(
                    "/api/mechanic/ask", json={"question": "q", "stance": "training"}
                )
                c.ok(br.status_code == 428, "training stance demands a committed prediction (428)")

                # hint: single-shot, tiered
                app.dependency_overrides[get_model_client] = scripted(
                    ModelResponse(text="Look at the SQL lane first.")
                )
                hr = await client.post(
                    "/api/mechanic/hint", json={"question": "why slow?", "tier": 0}
                )
                c.ok(
                    hr.status_code == 200 and bool(hr.json().get("hint")),
                    "hint returns a tiered hint",
                )

                # step-debugger: predict tool, first step IS a tool
                app.dependency_overrides[get_model_client] = scripted(
                    ModelResponse(
                        tool_calls=[ToolCall(id="s1", name="query_db", input={"sql": "SELECT 1"})]
                    )
                )
                st = await client.post(
                    "/api/mechanic/step", json={"question": "why slow?", "predict": "tool"}
                )
                sj = st.json()
                c.ok(
                    sj["kind"] == "tool_use" and sj["correct"] is True and sj["done"] is False,
                    "step 1 is a correctly-predicted tool call",
                )
                # step 2 resumes over the returned (editable) messages array
                app.dependency_overrides[get_model_client] = scripted(
                    ModelResponse(text="It is a Seq Scan on books.")
                )
                st2 = await client.post(
                    "/api/mechanic/step", json={"messages": sj["messages"], "predict": "tool"}
                )
                sj2 = st2.json()
                c.ok(
                    sj2["kind"] == "answer" and sj2["done"] is True and sj2["correct"] is False,
                    "step 2 answers; the wrong prediction is flagged",
                )
            finally:
                app.dependency_overrides.pop(get_model_client, None)

            # --- Phase 4: the Rounds (generated puzzles, assertion win, par) ---
            print("rounds:")
            gen = await client.post(
                "/api/rounds/generate", json={"fmt": "regression", "family": "missing_index"}
            )
            gj = gen.json()
            if not gj.get("symptom", {}).get("specimen_up", False):
                c.ok(False, "rounds need the lab specimen")
            else:
                rid = gj["id"]
                sym_types = _node_types(gj["symptom"]["plan"])
                c.ok(
                    any("Seq Scan" in (t or "") for t in sym_types),
                    "regression symptom is a seq scan",
                )

                sub = await client.post(
                    f"/api/rounds/{rid}/submit",
                    json={"fix_sql": "CREATE INDEX ON books(author_id)"},
                )
                sj = sub.json()
                c.ok(sj.get("won") is True, "the par fix wins the round")
                c.ok(sj.get("delta") == 0, "par fix is at par (delta 0)")

                gen2 = await client.post(
                    "/api/rounds/generate", json={"fmt": "regression", "family": "missing_index"}
                )
                rid2 = gen2.json()["id"]
                mask = await client.post(
                    f"/api/rounds/{rid2}/submit",
                    json={"fix_sql": "CREATE INDEX ON books(price)"},
                )
                c.ok(mask.json().get("won") is False, "a masking fix does not win")

                cad = await client.get("/api/rounds/cadence")
                c.ok(cad.json().get("reps", 0) >= 1, "cadence counts a rep after a win")

            # --- Phase 5: the Gym (rep predict-gate + homebase-log) + the Bench ---
            print("gym:")
            import tempfile
            from pathlib import Path

            from app.config import settings as _settings

            _settings.HOMEBASE_LOG_DIR = tempfile.mkdtemp(prefix="devbox-reps-")

            rc = await client.post("/api/reps", json={"topic": "windowed variance"})
            rep_id = rc.json()["id"]
            blocked = await client.post(f"/api/reps/{rep_id}/reflect", json={"reflection": "x"})
            c.ok(blocked.status_code == 428, "rep reflect is gated on a committed prediction")

            await client.post(f"/api/reps/{rep_id}/predict", json={"big_o": "O(n)"})
            done = await client.post(
                f"/api/reps/{rep_id}/reflect", json={"reflection": "linear as predicted"}
            )
            dj = done.json()
            c.ok(dj.get("logged") is True, "rep completes and writes the homebase-log")
            c.ok(Path(dj["log_path"]).exists(), "the rep log file exists at the configured path")

            lru_src = (
                "class Cache:\n"
                "    def __init__(self, capacity):\n"
                "        self.cap = capacity\n"
                "        self.d = OrderedDict()\n"
                "    def get(self, key):\n"
                "        if key not in self.d:\n"
                "            return None\n"
                "        self.d.move_to_end(key)\n"
                "        return self.d[key]\n"
                "    def set(self, key, value):\n"
                "        if key in self.d:\n"
                "            self.d.move_to_end(key)\n"
                "        self.d[key] = value\n"
                "        if len(self.d) > self.cap:\n"
                "            self.d.popitem(last=False)\n"
            )
            reg = await client.post(
                "/api/slots/cache/register", json={"name": "my LRU", "source": lru_src}
            )
            rj = reg.json()
            c.ok(
                rj.get("registered") is True and rj.get("correct") is True,
                "a hand-built LRU registers and benchmarks correct vs the reference",
            )
            bench = await client.get("/api/bench")
            bj = bench.json()
            c.ok(
                len(bj) >= 1 and "dust_days" in bj[0],
                "the bench lists impls with a derived dust signal",
            )

    if c.failures:
        print(f"\nSMOKE FAILED: {len(c.failures)} check(s) red")
        return 1
    print("\nSMOKE PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
