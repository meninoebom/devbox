"""Workbench — run arbitrary SQL against the lab specimen, return rows + plan.

Each successful run is recorded as a Trace(kind=workbench_run) so it shows up in
the Inspector's Lanes view and can be diffed against the previous run. The lab
query runs through asyncpg (LabRunner), so it is deliberately NOT captured by the
app's SQLAlchemy query listener — the plan we return is the lab's, not the app's.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.trace import Lane, TraceKind
from app.services import lab_runner
from app.services.plan_parser import parse
from app.services.trace_store import EventSpec, record_trace

router = APIRouter(prefix="/api/workbench", tags=["workbench"])


class RunRequest(BaseModel):
    sql: str
    setup_sql: str | None = None
    allow_writes: bool = False


@router.post("/run")
async def run_query(body: RunRequest, db: AsyncSession = Depends(get_db)):
    result = await lab_runner.run(body.sql, body.setup_sql, allow_writes=body.allow_writes)

    if not result.specimen_up:
        return {"specimen_up": False, "error": result.error}

    plan = None
    trace_id = None
    if not result.error and result.explain_json is not None:
        plan = parse(result.explain_json)
        events = [
            EventSpec(
                lane=Lane.QUERY_PLAN,
                duration_ms=result.duration_ms,
                detail={"plan": plan, "raw": None},
            ),
            EventSpec(
                lane=Lane.SQL,
                duration_ms=result.duration_ms,
                detail={"sql": body.sql, "params": None, "rows": result.row_count},
            ),
        ]
        trace = await record_trace(
            db,
            kind=TraceKind.WORKBENCH_RUN,
            label=body.sql.strip().splitlines()[0][:80] if body.sql.strip() else "(empty)",
            duration_ms=result.duration_ms,
            events=events,
            meta={
                "setup_sql": body.setup_sql,
                "row_count": result.row_count,
                "truncated": result.truncated,
            },
        )
        trace_id = trace.id

    return {
        "specimen_up": True,
        "error": result.error,
        "columns": result.columns,
        "rows": result.rows,
        "row_count": result.row_count,
        "truncated": result.truncated,
        "duration_ms": result.duration_ms,
        "plan": plan,
        "trace_id": trace_id,
    }
