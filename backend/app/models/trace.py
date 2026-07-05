"""The universal trace model — the board every DevBox surface reads.

A `Trace` is one observable action (an HTTP request, a Workbench run). It owns
an ordered list of `TraceEvent` spans, each tagged with a `lane`. Today only the
http / sql / query_plan lanes have producers; the rest of the enum is reserved so
later phases (cache, LLM, tool, embedding, memory, agent-loop) plug into the same
machinery with no schema change. Event payloads live in the generic `detail` JSON,
validated at the write boundary by per-lane Pydantic schemas.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base


class TraceKind(enum.StrEnum):
    REQUEST = "request"
    WORKBENCH_RUN = "workbench_run"
    AGENT_RUN = "agent_run"


class Lane(enum.StrEnum):
    HTTP = "http"
    SQL = "sql"
    QUERY_PLAN = "query_plan"
    # Reserved for later phases — no producers yet, but the board is one board.
    CACHE = "cache"
    LLM = "llm"
    TOOL = "tool"
    EMBEDDING = "embedding"
    MEMORY = "memory"
    LOOP = "loop"


# Store the enum *values* (not member names) as short VARCHARs with a CHECK
# constraint, so the column reads the same on SQLite and the lab Postgres.
_kind_col = Enum(
    TraceKind,
    native_enum=False,
    length=20,
    values_callable=lambda e: [m.value for m in e],
)
_lane_col = Enum(
    Lane,
    native_enum=False,
    length=20,
    values_callable=lambda e: [m.value for m in e],
)


class Trace(Base):
    __tablename__ = "traces"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[TraceKind] = mapped_column(_kind_col)
    label: Mapped[str] = mapped_column(String(500))
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    duration_ms: Mapped[float | None] = mapped_column(Float)
    meta: Mapped[dict | None] = mapped_column(JSON)

    events: Mapped[list[TraceEvent]] = relationship(
        back_populates="trace",
        order_by="TraceEvent.seq",
        cascade="all, delete-orphan",
        lazy="selectin",  # a trace is always read with its events; batch-load them
    )


class TraceEvent(Base):
    __tablename__ = "trace_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    trace_id: Mapped[int] = mapped_column(ForeignKey("traces.id", ondelete="CASCADE"), index=True)
    lane: Mapped[Lane] = mapped_column(_lane_col)
    seq: Mapped[int] = mapped_column(Integer)
    offset_ms: Mapped[float] = mapped_column(Float, default=0.0)
    duration_ms: Mapped[float | None] = mapped_column(Float)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)

    trace: Mapped[Trace] = relationship(back_populates="events")
