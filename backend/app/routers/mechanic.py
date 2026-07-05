"""The Mechanic endpoint. Stance follows the door: in the Workbench it answers
directly; in a training surface it will not deliver a final answer until a
prediction has been committed (a 428), unless the user explicitly asks for an
assist (which is recorded). The model client and tool runner are dependencies so
the gate can inject a scripted client + fake runner.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.trace import Lane, TraceKind
from app.services.mechanic import ToolRunner, run_loop
from app.services.mechanic_tools import real_tool_runner
from app.services.model_client import AnthropicClient, ModelClient, NoKeyClient
from app.services.trace_store import EventSpec, record_trace

router = APIRouter(prefix="/api/mechanic", tags=["mechanic"])


def get_model_client() -> ModelClient:
    if settings.ANTHROPIC_API_KEY:
        return AnthropicClient(settings.ANTHROPIC_API_KEY, settings.MECHANIC_MODEL)
    return NoKeyClient()


def get_tool_runner() -> ToolRunner:
    return real_tool_runner


class AskRequest(BaseModel):
    question: str
    stance: str = "workbench"  # "workbench" | "training"
    prediction_id: int | None = None
    assist: bool = False


@router.post("/ask")
async def ask(
    body: AskRequest,
    db: AsyncSession = Depends(get_db),
    client: ModelClient = Depends(get_model_client),
    tool_runner: ToolRunner = Depends(get_tool_runner),
):
    assisted = False
    if body.stance != "workbench" and body.prediction_id is None:
        if not body.assist:
            raise HTTPException(
                status_code=428,
                detail="Commit a prediction first, or ask the Mechanic for an assist.",
            )
        assisted = True

    out = await run_loop(client, body.question, tool_runner, stance=body.stance)

    events = list(out["events"])
    if assisted:
        events.insert(
            0,
            EventSpec(
                lane=Lane.LLM,
                detail={"summary": "assist: answered without a committed prediction"},
            ),
        )
    trace = await record_trace(
        db,
        kind=TraceKind.AGENT_RUN,
        label=(body.question[:80] or "(ask)"),
        duration_ms=None,
        events=events,
        meta={"stance": body.stance, "steps": out["steps"], "assisted": assisted},
    )
    return {
        "answer": out["answer"],
        "steps": out["steps"],
        "trace_id": trace.id,
        "assisted": assisted,
    }
