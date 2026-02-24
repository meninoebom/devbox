"""Request trace inspection endpoints for the DevBox inspector panel."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.request_trace import RequestTrace
from app.schemas.request_trace import RequestTraceRead

router = APIRouter(prefix="/api/traces", tags=["traces"])


@router.get("/latest", response_model=RequestTraceRead)
async def get_latest_trace(db: AsyncSession = Depends(get_db)):
    """Get the most recent request trace. The inspector panel polls this after each request."""
    result = await db.execute(
        select(RequestTrace).order_by(RequestTrace.id.desc()).limit(1)
    )
    trace = result.scalar_one_or_none()
    if not trace:
        raise HTTPException(status_code=404, detail="No traces recorded yet")
    return trace


@router.get("", response_model=list[RequestTraceRead])
async def list_traces(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List the most recent request traces."""
    result = await db.execute(
        select(RequestTrace).order_by(RequestTrace.id.desc()).limit(limit)
    )
    return result.scalars().all()


@router.get("/{trace_id}", response_model=RequestTraceRead)
async def get_trace(trace_id: int, db: AsyncSession = Depends(get_db)):
    """Get full detail for a single request trace."""
    trace = await db.get(RequestTrace, trace_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace
