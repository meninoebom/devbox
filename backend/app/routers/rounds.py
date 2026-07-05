"""The Rounds — generated data-floor puzzles, scored by par."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.round import Round
from app.services import rounds

router = APIRouter(prefix="/api/rounds", tags=["rounds"])


class GenerateRequest(BaseModel):
    fmt: str = "regression"  # "regression" | "target"
    family: str | None = None


class SubmitRequest(BaseModel):
    fix_sql: str
    query: str | None = None


@router.post("/generate")
async def generate_round(body: GenerateRequest, db: AsyncSession = Depends(get_db)):
    return await rounds.generate(db, fmt=body.fmt, family=body.family)


@router.post("/{round_id}/submit")
async def submit_round(round_id: int, body: SubmitRequest, db: AsyncSession = Depends(get_db)):
    r = await db.get(Round, round_id)
    if not r:
        raise HTTPException(status_code=404, detail="Round not found")
    return await rounds.submit(db, r, body.fix_sql, body.query)


@router.get("/cadence")
async def get_cadence(db: AsyncSession = Depends(get_db)):
    return await rounds.cadence(db)
