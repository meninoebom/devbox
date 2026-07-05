"""The Wager — commit a slate of calls, run the query, reveal all against it.

The client commits its calls in the request body before any result exists, so the
seal-then-run order here cannot let it cheat. Each call is sealed, the lab query is
the subject, and every call is revealed and written to calibration.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.prediction import CallSpec
from app.services import lab_runner
from app.services.assertions import metrics_from_run
from app.services.plan_parser import parse
from app.services.predictions import reveal, seal

router = APIRouter(prefix="/api", tags=["wager"])


class WagerRequest(BaseModel):
    sql: str
    setup_sql: str | None = None
    calls: list[CallSpec]


@router.post("/wager")
async def wager(body: WagerRequest, db: AsyncSession = Depends(get_db)):
    result = await lab_runner.run(body.sql, body.setup_sql)
    if not result.specimen_up:
        return {"specimen_up": False, "error": result.error}
    if result.error:
        return {"specimen_up": True, "error": result.error}

    plan = parse(result.explain_json)
    subject = metrics_from_run(
        {"row_count": result.row_count, "duration_ms": result.duration_ms}, plan
    )

    results = []
    for call in body.calls:
        p = await seal(db, call.target, call.predicted, call.confidence, call.tolerance)
        results.append(await reveal(db, p, subject))

    return {
        "specimen_up": True,
        "error": None,
        "subject": subject,
        "results": results,
        "rows": result.row_count,
        "duration_ms": result.duration_ms,
        "plan": plan,
    }
