"""A generated puzzle round. There is deliberately NO consecutive-day / streak
column: consistency is derived from solve timestamps (reps + trailing-14-day rate),
never a counter that can zero and shame (frozen decision).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.models.base import Base


class Round(Base):
    __tablename__ = "rounds"

    id: Mapped[int] = mapped_column(primary_key=True)
    family: Mapped[str] = mapped_column(String(50))
    fmt: Mapped[str] = mapped_column(String(20))  # "regression" | "target"
    schema_name: Mapped[str] = mapped_column(String(80))
    scale: Mapped[int] = mapped_column(Integer)
    baseline_query: Mapped[str] = mapped_column(Text)
    win_target: Mapped[str] = mapped_column(String(100))
    win_op: Mapped[str] = mapped_column(String(20))
    win_value: Mapped[Any] = mapped_column(JSON)
    par_changes: Mapped[int] = mapped_column(Integer)
    par_note: Mapped[str] = mapped_column(Text)
    target_ms: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    solved: Mapped[bool] = mapped_column(Boolean, default=False)
    solved_at: Mapped[datetime | None] = mapped_column(DateTime)
    best_changes: Mapped[int | None] = mapped_column(Integer)
