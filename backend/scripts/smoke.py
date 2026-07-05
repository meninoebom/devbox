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

    if c.failures:
        print(f"\nSMOKE FAILED: {len(c.failures)} check(s) red")
        return 1
    print("\nSMOKE PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
