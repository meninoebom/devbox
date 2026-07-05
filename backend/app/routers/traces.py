"""Trace inspection endpoints for the DevBox inspector panel.

Returns the parent Trace plus its ordered lane events. Events are eager-loaded
by the model's selectin relationship, so a single trace fetch is one round trip
plus one batched events query.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.trace import Trace
from app.schemas.trace import TraceRead, TraceSummary

router = APIRouter(prefix="/api/traces", tags=["traces"])


@router.get("/latest", response_model=TraceRead)
async def get_latest_trace(db: AsyncSession = Depends(get_db)):
    """Get the most recent trace. The inspector panel fetches this after a request."""
    result = await db.execute(select(Trace).order_by(Trace.id.desc()).limit(1))
    trace = result.scalar_one_or_none()
    if not trace:
        raise HTTPException(status_code=404, detail="No traces recorded yet")
    return trace


@router.get("", response_model=list[TraceSummary])
async def list_traces(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """List the most recent traces (summaries, without event payloads)."""
    result = await db.execute(select(Trace).order_by(Trace.id.desc()).limit(limit))
    return result.scalars().all()


@router.get("/{trace_id}", response_model=TraceRead)
async def get_trace(trace_id: int, db: AsyncSession = Depends(get_db)):
    """Get the full parent+events tree for a single trace."""
    trace = await db.get(Trace, trace_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace
