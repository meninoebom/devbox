"""Prediction sealing + revealing + calibration writing.

Reveal is seal-once: calling it on an already-revealed prediction raises, which is
how "a sealed prediction cannot be mutated" is enforced. `predicted` is never
written after creation.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prediction import CalibrationRecord, Prediction

_NOTSET = object()


class AlreadyRevealedError(Exception):
    """Raised when a prediction is revealed a second time."""


def _match(predicted: Any, actual: Any, tolerance: float | None) -> bool:
    """Did the prediction come true? Numbers use tolerance (default exact);
    everything else is exact equality. bool is compared as bool, not as a number."""
    if isinstance(predicted, bool) or isinstance(actual, bool):
        return predicted == actual
    if isinstance(predicted, (int, float)) and isinstance(actual, (int, float)):
        tol = tolerance if tolerance is not None else 0
        return abs(actual - predicted) <= tol
    return predicted == actual


async def seal(
    session: AsyncSession,
    target: str,
    predicted: Any,
    confidence: float | None = None,
    tolerance: float | None = None,
) -> Prediction:
    p = Prediction(target=target, predicted=predicted, confidence=confidence, tolerance=tolerance)
    session.add(p)
    await session.commit()
    await session.refresh(p)
    return p


async def reveal(
    session: AsyncSession, prediction: Prediction, subject: dict[str, Any]
) -> dict[str, Any]:
    if prediction.revealed:
        raise AlreadyRevealedError(f"prediction {prediction.id} already revealed")

    actual = subject.get(prediction.target, _NOTSET)
    if actual is _NOTSET:
        actual_val: Any = None
        correct = False
        detail = f"target '{prediction.target}' not present in subject"
    else:
        actual_val = actual
        correct = _match(prediction.predicted, actual_val, prediction.tolerance)
        detail = f"predicted {prediction.predicted!r}, actual {actual_val!r}"

    prediction.actual = actual_val
    prediction.correct = correct
    prediction.revealed = True
    session.add(
        CalibrationRecord(
            target=prediction.target,
            predicted=prediction.predicted,
            actual=actual_val,
            confidence=prediction.confidence,
            correct=correct,
        )
    )
    await session.commit()
    await session.refresh(prediction)

    return {
        "prediction_id": prediction.id,
        "target": prediction.target,
        "predicted": prediction.predicted,
        "actual": actual_val,
        "correct": correct,
        "confidence": prediction.confidence,
        "detail": detail,
    }
