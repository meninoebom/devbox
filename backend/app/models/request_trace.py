"""RequestTrace model — captures the full lifecycle of an HTTP request for the inspector."""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RequestTrace(Base):
    __tablename__ = "request_traces"

    id: Mapped[int] = mapped_column(primary_key=True)
    method: Mapped[str] = mapped_column(String(10))
    path: Mapped[str] = mapped_column(String(500))
    query_params: Mapped[str | None] = mapped_column(Text)
    request_headers: Mapped[str | None] = mapped_column(Text)
    request_body: Mapped[str | None] = mapped_column(Text)
    response_status: Mapped[int] = mapped_column(Integer)
    response_headers: Mapped[str | None] = mapped_column(Text)
    response_body: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[float] = mapped_column(Float)
    sql_queries: Mapped[str | None] = mapped_column(Text)  # JSON-encoded list
    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
