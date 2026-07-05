"""The runtime tool runner: the Mechanic's tools ARE DevBox's own API.

Each tool is a real (in-process ASGI) call to the app, so every tool call flows
through the tracing middleware and shows up in the Inspector like any other
request. The gate swaps this out for a fake runner, so nested calls never happen
in tests.
"""

from __future__ import annotations

from typing import Any

import httpx


async def real_tool_runner(name: str, tool_input: dict) -> dict[str, Any]:
    from app.main import app  # late import: the tool calls the app that hosts it

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://mechanic") as c:
        if name == "query_db":
            r = await c.post("/api/workbench/run", json={"sql": tool_input.get("sql", "")})
            d = r.json()
            plan_root = (d.get("plan") or {}).get("root", {}).get("node_type")
            return {
                "rows": d.get("row_count"),
                "columns": d.get("columns"),
                "plan_root": plan_root,
                "error": d.get("error"),
                "trace_id": d.get("trace_id"),
            }
        if name == "read_source":
            r = await c.get(f"/api/meta/source/{tool_input.get('path', '')}")
            if r.status_code == 200:
                return r.json()
            return {"error": r.text, "status": r.status_code}
        if name == "call_api":
            r = await c.get(tool_input.get("path", "/"))
            try:
                body: Any = r.json()
            except Exception:
                body = r.text
            return {"status": r.status_code, "body": body}
        return {"error": f"unknown tool '{name}'"}
