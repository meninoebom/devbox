"""A case file — a real question worked in a seeded world. The two-context rule is
structural: a case cannot close until the principle has been solved in world-1 AND
ported to a deliberately different world-2. The explain-back is meant to be
domain-independent (a human/skeptic check, not a machine one).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CaseFile(Base):
    __tablename__ = "case_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    question: Mapped[str] = mapped_column(Text)
    principle: Mapped[str] = mapped_column(String(50), default="missing_index")
    status: Mapped[str] = mapped_column(String(20), default="open")  # open|advanced|closed
    schema_1: Mapped[str] = mapped_column(String(80))
    template_1: Mapped[str] = mapped_column(String(40), default="books")
    schema_2: Mapped[str | None] = mapped_column(String(80))
    template_2: Mapped[str | None] = mapped_column(String(40))
    context1_solved: Mapped[bool] = mapped_column(Boolean, default=False)
    context2_solved: Mapped[bool] = mapped_column(Boolean, default=False)
    context1_note: Mapped[str | None] = mapped_column(Text)
    context2_note: Mapped[str | None] = mapped_column(Text)
    explain_back: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime)
