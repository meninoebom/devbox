"""Prediction sealing/revealing + the calibration read model."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.prediction import CalibrationRecord, Prediction
from app.schemas.prediction import CalibrationSummaryRow, CallSpec, RevealRequest, RevealResult
from app.services.predictions import AlreadyRevealedError, reveal, seal

router = APIRouter(prefix="/api", tags=["predictions"])


@router.post("/predictions")
async def seal_prediction(body: CallSpec, db: AsyncSession = Depends(get_db)):
    """Seal a prediction. Immutable from here; only a reveal may touch it."""
    p = await seal(db, body.target, body.predicted, body.confidence, body.tolerance)
    return {"id": p.id, "target": p.target, "sealed": True}


@router.post("/predictions/{prediction_id}/reveal", response_model=RevealResult)
async def reveal_prediction(
    prediction_id: int, body: RevealRequest, db: AsyncSession = Depends(get_db)
):
    p = await db.get(Prediction, prediction_id)
    if not p:
        raise HTTPException(status_code=404, detail="Prediction not found")
    try:
        return await reveal(db, p, body.subject)
    except AlreadyRevealedError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.get("/calibration", response_model=list[CalibrationSummaryRow])
async def calibration_summary(db: AsyncSession = Depends(get_db)):
    """Descriptive calibration per target: how often calls came true, and the mean
    confidence attached. No score, by design."""
    # SQLite stores bool as 0/1, so AVG(correct) is the accuracy directly.
    rows = await db.execute(
        select(
            CalibrationRecord.target,
            func.count().label("n"),
            func.avg(CalibrationRecord.correct).label("acc"),
            func.avg(CalibrationRecord.confidence).label("conf"),
        ).group_by(CalibrationRecord.target)
    )
    out = []
    for target, n, acc, conf in rows.all():
        out.append(
            CalibrationSummaryRow(
                target=target,
                n=n,
                accuracy=round(float(acc or 0), 3),
                avg_confidence=round(float(conf), 3) if conf is not None else None,
            )
        )
    return out
