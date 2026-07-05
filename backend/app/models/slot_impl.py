"""A registered slot implementation on the Bench — the user's hand-built version,
kept and benchmarked. `last_run_at` drives the ambient dusty-decay signal; there is
no streak counter.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SlotImpl(Base):
    __tablename__ = "slot_impls"

    id: Mapped[int] = mapped_column(primary_key=True)
    slot: Mapped[str] = mapped_column(String(50))  # e.g. "cache_backend"
    name: Mapped[str] = mapped_column(String(120))
    source: Mapped[str] = mapped_column(Text)
    correct: Mapped[bool] = mapped_column(Boolean)
    hits: Mapped[int | None] = mapped_column(Integer)
    ref_hits: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_run_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
