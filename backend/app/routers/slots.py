"""Pluggable slots + the Bench. Register a hand-built CacheBackend, benchmark it
against the reference (verdict via the assertion engine), record it, and record a
benchmark trace. The Bench lists registered impls with an ambient dusty-decay signal
derived from last_run_at (no streak counter).
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.slot_impl import SlotImpl
from app.models.trace import Lane, TraceKind
from app.services import slots
from app.services.trace_store import EventSpec, record_trace

router = APIRouter(prefix="/api", tags=["slots"])


class RegisterCache(BaseModel):
    name: str
    source: str


@router.post("/slots/cache/register")
async def register_cache(body: RegisterCache, db: AsyncSession = Depends(get_db)):
    try:
        result = slots.benchmark_cache(body.source)
    except Exception as e:  # a bad submission is a message, not a 500
        return {"registered": False, "error": f"{type(e).__name__}: {e}"}

    impl = SlotImpl(
        slot="cache_backend",
        name=body.name,
        source=body.source,
        correct=result.correct,
        hits=result.hits,
        ref_hits=result.ref_hits,
    )
    db.add(impl)
    await db.commit()
    await db.refresh(impl)

    # A benchmark trace: your run vs the reference run, on the tool lane.
    await record_trace(
        db,
        kind=TraceKind.BENCHMARK,
        label=f"cache_backend: {body.name}",
        duration_ms=None,
        events=[
            EventSpec(
                lane=Lane.TOOL,
                detail={"impl": "yours", "hits": result.hits, "correct": result.correct},
            ),
            EventSpec(lane=Lane.TOOL, detail={"impl": "reference", "hits": result.ref_hits}),
        ],
        meta={"detail": result.detail},
    )

    return {
        "registered": True,
        "id": impl.id,
        "correct": result.correct,
        "hits": result.hits,
        "ref_hits": result.ref_hits,
        "detail": result.detail,
    }


@router.get("/bench")
async def bench(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(SlotImpl).order_by(SlotImpl.last_run_at.desc()))
    now = datetime.now(UTC)
    out = []
    for s in rows.scalars().all():
        last = s.last_run_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=UTC)
        dust_days = (now - last).days  # derived, not stored; the ambient decay signal
        out.append(
            {
                "id": s.id,
                "slot": s.slot,
                "name": s.name,
                "correct": s.correct,
                "hits": s.hits,
                "ref_hits": s.ref_hits,
                "dust_days": dust_days,
            }
        )
    return out
