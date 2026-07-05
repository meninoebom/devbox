"""Gym reps: create -> predict (gated) -> reflect (+ homebase-log)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.rep import Rep
from app.services import reps

router = APIRouter(prefix="/api/reps", tags=["reps"])


class CreateRep(BaseModel):
    topic: str
    restate: str | None = None


class PredictBody(BaseModel):
    big_o: str


class ReflectBody(BaseModel):
    reflection: str


def _view(r: Rep) -> dict:
    return {"id": r.id, "topic": r.topic, "phase": r.phase, "big_o": r.big_o, "logged": r.logged}


@router.post("")
async def create_rep(body: CreateRep, db: AsyncSession = Depends(get_db)):
    return _view(await reps.create(db, body.topic, body.restate))


@router.post("/{rep_id}/predict")
async def predict(rep_id: int, body: PredictBody, db: AsyncSession = Depends(get_db)):
    r = await db.get(Rep, rep_id)
    if not r:
        raise HTTPException(status_code=404, detail="Rep not found")
    return _view(await reps.commit_prediction(db, r, body.big_o))


@router.post("/{rep_id}/reflect")
async def reflect(rep_id: int, body: ReflectBody, db: AsyncSession = Depends(get_db)):
    r = await db.get(Rep, rep_id)
    if not r:
        raise HTTPException(status_code=404, detail="Rep not found")
    try:
        return await reps.reflect(db, r, body.reflection)
    except reps.PredictionRequiredError as e:
        raise HTTPException(status_code=428, detail=str(e)) from e


@router.get("")
async def list_reps(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(Rep).order_by(Rep.id.desc()).limit(50))
    return [_view(r) for r in rows.scalars().all()]
