"""A gym rep — deliberate practice ported from engineering-gym. The predict phase
is gated: you cannot advance to reflect without a committed Big-O prediction (which
is a real sealed Prediction from Phase 2). On completion a section is appended to
the homebase-log, continuing the gym's convention.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Rep(Base):
    __tablename__ = "reps"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic: Mapped[str] = mapped_column(String(200))
    phase: Mapped[str] = mapped_column(String(20), default="predict")  # predict|code|reflect|done
    prediction_id: Mapped[int | None] = mapped_column(ForeignKey("predictions.id"))
    big_o: Mapped[str | None] = mapped_column(String(100))
    restate: Mapped[str | None] = mapped_column(Text)
    reflection: Mapped[str | None] = mapped_column(Text)
    logged: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
