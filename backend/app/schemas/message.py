"""Pydantic schemas for Message."""

from datetime import datetime

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    author: str = Field(..., min_length=1, max_length=100)


class MessageUpdate(BaseModel):
    content: str | None = Field(None, min_length=1, max_length=5000)
    author: str | None = Field(None, min_length=1, max_length=100)


class MessageRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    content: str
    author: str
    created_at: datetime
    updated_at: datetime | None = None
