"""Prediction + CalibrationRecord — the conscience.

A Prediction is sealed before a reveal; its `predicted` value is never mutated
(only `actual`/`correct`/`revealed` are set, once, at reveal). Each reveal appends
an immutable CalibrationRecord. Calibration is a mirror, not a scoreboard: there is
deliberately no points/score column anywhere here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.models.base import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    target: Mapped[str] = mapped_column(String(100))
    predicted: Mapped[Any] = mapped_column(JSON)  # immutable after seal
    confidence: Mapped[float | None] = mapped_column(Float)
    tolerance: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    revealed: Mapped[bool] = mapped_column(Boolean, default=False)
    actual: Mapped[Any | None] = mapped_column(JSON)
    correct: Mapped[bool | None] = mapped_column(Boolean)


class CalibrationRecord(Base):
    __tablename__ = "calibration_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    target: Mapped[str] = mapped_column(String(100))
    predicted: Mapped[Any] = mapped_column(JSON)
    actual: Mapped[Any | None] = mapped_column(JSON)
    confidence: Mapped[float | None] = mapped_column(Float)
    correct: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
