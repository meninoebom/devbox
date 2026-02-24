"""Pydantic schemas for User."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class UserRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    username: str
    email: str
    created_at: datetime
