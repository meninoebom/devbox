"""The Mechanic — a hand-rolled agent loop. No framework, on purpose: the loop IS
the lesson. It talks to a ModelClient and a tool_runner (both injected), records an
llm event per model call and a tool event per tool call, and stops when the model
answers with no tool_use. Keep this file small; the frozen decision caps the loop.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable

from app.models.trace import Lane
from app.services.model_client import ModelClient
from app.services.trace_store import EventSpec

ToolRunner = Callable[[str, dict], Awaitable[dict]]

# Brandon's explanation contract lives here, verbatim in spirit (frozen decision).
_SYSTEM_BASE = """You are the Mechanic, the resident engineer inside DevBox, a \
full-stack app built to be taken apart. You help understand how it works by using \
its own API as your tools.

How to explain, always:
1. Answer first: lead with the conclusion, then justify it.
2. Define a term before you lean on it, in plain words.
3. Reason in short numbered steps, one idea each.
4. Prefer the clear long way over the compressed way; no jargon-stacking.
5. End with the takeaway and what it means.

Gather evidence with tools before answering. When you have enough, give a final \
answer with no tool call."""

_DIRECT = "\n\nThe user is at the Workbench, a working surface. Answer directly and fully."
_SOCRATIC = (
    "\n\nThe user is in a training surface. Do not hand over the answer: ask what "
    "they expect to see first, and confirm only after they have committed."
)

TOOL_SCHEMAS = [
    {
        "name": "query_db",
        "description": "Run read-only SQL against the lab database; returns rows and the plan.",
        "input_schema": {
            "type": "object",
            "properties": {"sql": {"type": "string"}},
            "required": ["sql"],
        },
    },
    {
        "name": "read_source",
        "description": "Read the source of a module inside app/ (e.g. routers/workbench.py).",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
    {
        "name": "call_api",
        "description": "GET one of DevBox's own endpoints (e.g. /api/traces/latest).",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
]


def system_prompt(stance: str) -> str:
    return _SYSTEM_BASE + (_DIRECT if stance == "workbench" else _SOCRATIC)


async def run_loop(
    client: ModelClient,
    question: str,
    tool_runner: ToolRunner,
    *,
    stance: str = "workbench",
    max_steps: int = 6,
) -> dict:
    """Drive one conversation to a final answer. Returns the answer plus the lane
    events (llm + tool) for the trace and the step count."""
    system = system_prompt(stance)
    messages: list[dict] = [{"role": "user", "content": question}]
    events: list[EventSpec] = []

    for step in range(1, max_steps + 1):
        resp = await client.complete(system, messages, TOOL_SCHEMAS)
        events.append(
            EventSpec(
                lane=Lane.LLM,
                detail={
                    "summary": f"model call {step}",
                    "text": (resp.text or "")[:500],
                    "tool_calls": [t.name for t in resp.tool_calls],
                },
            )
        )
        if not resp.wants_tool:
            return {"answer": resp.text or "", "events": events, "steps": step}

        messages.append(
            {
                "role": "assistant",
                "content": [
                    {"type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.input}
                    for tc in resp.tool_calls
                ],
            }
        )
        results = []
        for tc in resp.tool_calls:
            out = await tool_runner(tc.name, tc.input)
            events.append(
                EventSpec(
                    lane=Lane.TOOL, detail={"name": tc.name, "input": tc.input, "output": out}
                )
            )
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tc.id,
                    "content": json.dumps(out, default=str)[:2000],
                }
            )
        messages.append({"role": "user", "content": results})

    return {
        "answer": "(stopped: reached the step limit without a final answer)",
        "events": events,
        "steps": max_steps,
    }
