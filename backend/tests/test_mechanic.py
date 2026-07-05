"""Spec gate: the Mechanic loop, prompts, framework-freedom, and the stance gate."""

import asyncio
import pathlib

import httpx

from app.main import app
from app.models.trace import Lane
from app.services.mechanic import run_loop, system_prompt
from app.services.model_client import ModelResponse, ScriptedClient, ToolCall

SERVICES = pathlib.Path(__file__).resolve().parent.parent / "app" / "services"


def test_loop_terminates_on_text_with_no_tools():
    async def scenario():
        client = ScriptedClient([ModelResponse(text="The answer.")])
        used = []

        async def runner(name, inp):
            used.append(name)
            return {}

        out = await run_loop(client, "q", runner, stance="workbench")
        assert out["answer"] == "The answer."
        assert out["steps"] == 1
        assert used == []  # no tool called
        assert [e.lane for e in out["events"]] == [Lane.LLM]

    asyncio.run(scenario())


def test_tool_use_dispatches_then_answers():
    async def scenario():
        client = ScriptedClient(
            [
                ModelResponse(
                    tool_calls=[ToolCall(id="t1", name="query_db", input={"sql": "SELECT 1"})]
                ),
                ModelResponse(text="Done: it uses a Seq Scan."),
            ]
        )
        seen = []

        async def runner(name, inp):
            seen.append((name, inp))
            return {"plan_root": "Seq Scan"}

        out = await run_loop(client, "q", runner)
        assert out["steps"] == 2
        assert seen == [("query_db", {"sql": "SELECT 1"})]
        assert [e.lane for e in out["events"]] == [Lane.LLM, Lane.TOOL, Lane.LLM]
        assert "seq scan" in out["answer"].lower()

    asyncio.run(scenario())


def test_stance_shapes_the_prompt():
    assert "directly" in system_prompt("workbench").lower()
    assert "do not hand over" in system_prompt("training").lower()
    assert "answer first" in system_prompt("workbench").lower()  # the explanation contract


def test_no_agent_framework_imports():
    forbidden = (
        "langchain",
        "llama_index",
        "crewai",
        "autogen",
        "langgraph",
        "haystack",
        "semantic_kernel",
    )
    hits = []
    for name in ("mechanic.py", "model_client.py", "mechanic_tools.py"):
        text = (SERVICES / name).read_text(encoding="utf-8")
        hits += [f"{name}:{fw}" for fw in forbidden if fw in text]
    assert hits == [], f"agent framework used (frozen decision forbids it): {hits}"


def test_loop_stays_small():
    # No-bloat guard on the hand-rolled loop (frozen decision: ~150 lines).
    n = len((SERVICES / "mechanic.py").read_text(encoding="utf-8").splitlines())
    assert n <= 160, f"mechanic.py is {n} lines; keep the loop small"


def test_training_stance_requires_a_prediction():
    async def scenario():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/api/mechanic/ask", json={"question": "q", "stance": "training"})
            assert r.status_code == 428

    asyncio.run(scenario())
