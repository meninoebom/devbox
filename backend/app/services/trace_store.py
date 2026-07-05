"""TraceStore — the one place traces get written.

Deep module, narrow interface: callers hand over a finished action (its kind,
label, duration, and an ordered list of lane events) and get back a persisted
`Trace`. Detail payloads are validated per-lane on the way in, seq numbers are
assigned here, and the JSON serialization stays hidden. The tracing middleware
and the Workbench are both just clients of this.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trace import Lane, Trace, TraceEvent, TraceKind
from app.schemas.trace import validate_detail


@dataclass
class EventSpec:
    """One lane event, before it has a seq or a row."""

    lane: Lane
    detail: dict[str, Any]
    offset_ms: float = 0.0
    duration_ms: float | None = None


async def record_trace(
    session: AsyncSession,
    *,
    kind: TraceKind,
    label: str,
    duration_ms: float | None,
    events: list[EventSpec],
    meta: dict[str, Any] | None = None,
) -> Trace:
    """Persist a trace and its events in one commit, returning the loaded row."""
    trace = Trace(kind=kind, label=label, duration_ms=duration_ms, meta=meta)
    for seq, spec in enumerate(events):
        trace.events.append(
            TraceEvent(
                lane=spec.lane,
                seq=seq,
                offset_ms=spec.offset_ms,
                duration_ms=spec.duration_ms,
                detail=validate_detail(spec.lane, spec.detail),
            )
        )
    session.add(trace)
    await session.commit()
    await session.refresh(trace)
    return trace
