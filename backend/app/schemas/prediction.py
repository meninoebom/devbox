"""Schemas for the prediction / calibration surface."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class CallSpec(BaseModel):
    """A single committed prediction: 'I call that <target> will be <predicted>'."""

    target: str
    predicted: Any
    confidence: float | None = None
    tolerance: float | None = None


class RevealRequest(BaseModel):
    """Reveal a sealed prediction against an already-produced subject (metrics)."""

    subject: dict[str, Any]


class RevealResult(BaseModel):
    prediction_id: int
    target: str
    predicted: Any
    actual: Any = None
    correct: bool
    confidence: float | None = None
    detail: str = ""


class CalibrationSummaryRow(BaseModel):
    target: str
    n: int
    accuracy: float
    avg_confidence: float | None = None
