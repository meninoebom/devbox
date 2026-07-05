"""Case files — real questions worked across two worlds (the two-context rule)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.case_file import CaseFile
from app.services import cases

router = APIRouter(prefix="/api/cases", tags=["cases"])


class CreateCase(BaseModel):
    title: str
    question: str


class InvestigateBody(BaseModel):
    sql: str
    setup_sql: str | None = None


class NoteBody(BaseModel):
    note: str


class PortBody(BaseModel):
    fix_sql: str
    note: str | None = None


class CloseBody(BaseModel):
    explain_back: str


async def _get(db: AsyncSession, case_id: int) -> CaseFile:
    c = await db.get(CaseFile, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    return c


@router.post("")
async def create_case(body: CreateCase, db: AsyncSession = Depends(get_db)):
    return await cases.create(db, body.title, body.question)


@router.post("/{case_id}/investigate")
async def investigate(case_id: int, body: InvestigateBody, db: AsyncSession = Depends(get_db)):
    return await cases.investigate(db, await _get(db, case_id), body.sql, body.setup_sql)


@router.post("/{case_id}/advance")
async def advance(case_id: int, body: NoteBody, db: AsyncSession = Depends(get_db)):
    return await cases.advance(db, await _get(db, case_id), body.note)


@router.post("/{case_id}/port")
async def port(case_id: int, body: PortBody, db: AsyncSession = Depends(get_db)):
    return await cases.port(db, await _get(db, case_id), body.fix_sql, body.note)


@router.post("/{case_id}/close")
async def close(case_id: int, body: CloseBody, db: AsyncSession = Depends(get_db)):
    try:
        return await cases.close(db, await _get(db, case_id), body.explain_back)
    except cases.TwoContextRequiredError as e:
        raise HTTPException(status_code=428, detail=str(e)) from e


@router.get("")
async def list_cases(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(CaseFile).order_by(CaseFile.id.desc()).limit(50))
    return [cases._view(c) for c in rows.scalars().all()]
