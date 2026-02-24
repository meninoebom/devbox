"""Pydantic schemas for RequestTrace."""

from datetime import datetime

from pydantic import BaseModel


class RequestTraceRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    method: str
    path: str
    query_params: str | None = None
    request_headers: str | None = None
    request_body: str | None = None
    response_status: int
    response_headers: str | None = None
    response_body: str | None = None
    duration_ms: float
    sql_queries: str | None = None
    timestamp: datetime
