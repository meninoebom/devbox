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

            # --- Phase 3: the Mechanic (scripted model, REAL traced tool call) ---
            print("mechanic:")
            from app.routers.mechanic import get_model_client
            from app.services.model_client import ModelResponse, ScriptedClient, ToolCall

            app.dependency_overrides[get_model_client] = lambda: ScriptedClient(
                [
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
                ]
            )
            try:
                ar = await client.post(
                    "/api/mechanic/ask",
                    json={"question": "how big is authors?", "stance": "workbench"},
                )
                aj = ar.json()
                c.ok(
                    ar.status_code == 200 and bool(aj.get("answer")),
                    "mechanic answers a workbench question",
                )
                at = await client.get(f"/api/traces/{aj['trace_id']}")
                atj = at.json()
                alanes = [e["lane"] for e in atj["events"]]
                c.ok(atj["kind"] == "agent_run", "mechanic trace kind == agent_run")
                c.ok("llm" in alanes and "tool" in alanes, "mechanic trace has llm + tool lanes")

                br = await client.post(
                    "/api/mechanic/ask", json={"question": "q", "stance": "training"}
                )
                c.ok(br.status_code == 428, "training stance demands a committed prediction (428)")
            finally:
                app.dependency_overrides.pop(get_model_client, None)

    if c.failures:
        print(f"\nSMOKE FAILED: {len(c.failures)} check(s) red")
        return 1
    print("\nSMOKE PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
