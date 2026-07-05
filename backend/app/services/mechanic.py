"""The Mechanic — a hand-rolled agent loop. No framework, on purpose: the loop IS
the lesson. `step_once` runs exactly one turn (a model call, then any tool it asked
for); `run_loop` just calls it until the model answers. Prompts and tool schemas
live in mechanic_prompts.py so this file stays small (frozen decision).
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable

from app.models.trace import Lane
from app.services.mechanic_prompts import TOOL_SCHEMAS, system_prompt
from app.services.model_client import ModelClient
from app.services.trace_store import EventSpec

# Re-exported so callers can `from app.services.mechanic import system_prompt`.
__all__ = ["ToolRunner", "run_loop", "step_once", "system_prompt"]

ToolRunner = Callable[[str, dict], Awaitable[dict]]


async def step_once(
    client: ModelClient, messages: list[dict], tool_runner: ToolRunner, stance: str
) -> dict:
    """One turn: a model call, then any tools it requested. Returns the events
    produced, the updated messages array, and whether the loop is done. Stateless,
    so a caller (run_loop, or the step-debugger) owns the messages array."""
    resp = await client.complete(system_prompt(stance), messages, TOOL_SCHEMAS)
    events = [
        EventSpec(
            lane=Lane.LLM,
            detail={
                "summary": "model call",
                "text": (resp.text or "")[:500],
                "tool_calls": [t.name for t in resp.tool_calls],
            },
        )
    ]
    if not resp.wants_tool:
        return {
            "kind": "answer",
            "answer": resp.text or "",
            "events": events,
            "messages": messages,
            "done": True,
        }

    new_messages = messages + [
        {
            "role": "assistant",
            "content": [
                {"type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.input}
                for tc in resp.tool_calls
            ],
        }
    ]
    results = []
    for tc in resp.tool_calls:
        out = await tool_runner(tc.name, tc.input)
        events.append(
            EventSpec(lane=Lane.TOOL, detail={"name": tc.name, "input": tc.input, "output": out})
        )
        results.append(
            {
                "type": "tool_result",
                "tool_use_id": tc.id,
                "content": json.dumps(out, default=str)[:2000],
            }
        )
    return {
        "kind": "tool_use",
        "tools": [tc.name for tc in resp.tool_calls],
        "events": events,
        "messages": new_messages + [{"role": "user", "content": results}],
        "done": False,
    }


async def run_loop(
    client: ModelClient,
    question: str,
    tool_runner: ToolRunner,
    *,
    stance: str = "workbench",
    max_steps: int = 6,
) -> dict:
    """Drive one conversation to a final answer, collecting lane events for the trace."""
    messages: list[dict] = [{"role": "user", "content": question}]
    events: list[EventSpec] = []
    for step in range(1, max_steps + 1):
        s = await step_once(client, messages, tool_runner, stance)
        events += s["events"]
        messages = s["messages"]
        if s["done"]:
            return {"answer": s["answer"], "events": events, "steps": step}
    return {
        "answer": "(stopped: reached the step limit without a final answer)",
        "events": events,
        "steps": max_steps,
    }
