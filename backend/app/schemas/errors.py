"""Standardized error response schemas."""

from pydantic import BaseModel


class ValidationErrorDetail(BaseModel):
    loc: list[str | int]
    msg: str
    type: str


class ErrorResponse(BaseModel):
    detail: str
    errors: list[ValidationErrorDetail] | None = None
