"""Pydantic schemas for Project."""

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    tags: list[str] | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    tags: list[str] | None = None


class ProjectRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    description: str | None = None
    tags: str | None = None  # JSON string from DB
    cover_image_path: str | None = None
    owner_id: int
    created_at: datetime
