"""Pydantic schemas for the universal trace.

Read schemas return the parent+events tree the Inspector renders. The per-lane
detail models are the write boundary: `validate_detail` runs the right one before
an event is stored, so junk never reaches the JSON column even though the column
itself is schemaless.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.trace import Lane, TraceKind

# --- Read side (parent + events tree) ---


class TraceEventRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    lane: Lane
    seq: int
    offset_ms: float
    duration_ms: float | None = None
    detail: dict[str, Any]


class TraceRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    kind: TraceKind
    label: str
    started_at: datetime
    duration_ms: float | None = None
    meta: dict[str, Any] | None = None
    events: list[TraceEventRead] = []


class TraceSummary(BaseModel):
    """Lightweight row for the trace list — no event payloads."""

    model_config = {"from_attributes": True}

    id: int
    kind: TraceKind
    label: str
    started_at: datetime
    duration_ms: float | None = None


# --- Write boundary (per-lane detail validation) ---


class HttpDetail(BaseModel):
    method: str
    path: str
    query_params: str | None = None
    request_headers: dict[str, str] = {}
    request_body: str | None = None
    response_status: int
    response_headers: dict[str, str] = {}
    response_body: str | None = None


class SqlDetail(BaseModel):
    sql: str
    params: str | None = None
    rows: int | None = None


class QueryPlanDetail(BaseModel):
    plan: dict[str, Any]
    raw: Any | None = None


_DETAIL_MODELS: dict[Lane, type[BaseModel]] = {
    Lane.HTTP: HttpDetail,
    Lane.SQL: SqlDetail,
    Lane.QUERY_PLAN: QueryPlanDetail,
}


def validate_detail(lane: Lane, detail: dict[str, Any]) -> dict[str, Any]:
    """Validate an event's detail against its lane schema, returning a plain dict
    ready for the JSON column. Lanes without a producer yet pass through as-is."""
    model = _DETAIL_MODELS.get(lane)
    if model is None:
        return detail
    return model.model_validate(detail).model_dump()
