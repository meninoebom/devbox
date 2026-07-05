"""Spec gate: seal is immutable, reveal is once-only, calibration is recorded."""

import asyncio

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models  # noqa: F401  (register all tables on Base.metadata)
from app.models.base import Base
from app.models.prediction import CalibrationRecord
from app.services.predictions import AlreadyRevealedError, _match, reveal, seal


def _run(make_coro):
    async def wrap():
        engine = create_async_engine("sqlite+aiosqlite://")
        async with engine.begin() as c:
            await c.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as s:
            return await make_coro(s)

    return asyncio.run(wrap())


@pytest.mark.parametrize(
    "predicted,actual,tol,expected",
    [
        (100, 100, None, True),
        (100, 101, None, False),
        (100, 105, 10, True),
        (True, True, None, True),
        (True, False, None, False),
        ("Gather", "Gather", None, True),
        ("Gather", "Seq Scan", None, False),
    ],
)
def test_match(predicted, actual, tol, expected):
    assert _match(predicted, actual, tol) is expected


def test_seal_then_reveal_records_calibration():
    async def scenario(s):
        p = await seal(s, "rows", 100, confidence=0.8)
        assert p.revealed is False
        diff = await reveal(s, p, {"rows": 100})
        assert diff["correct"] is True
        assert diff["actual"] == 100
        recs = (await s.execute(select(CalibrationRecord))).scalars().all()
        assert len(recs) == 1 and recs[0].correct is True
        return p

    _run(scenario)


def test_reveal_twice_raises_and_leaves_predicted_intact():
    async def scenario(s):
        p = await seal(s, "rows", 100)
        await reveal(s, p, {"rows": 42})
        assert p.correct is False
        assert p.predicted == 100  # predicted never mutated
        with pytest.raises(AlreadyRevealedError):
            await reveal(s, p, {"rows": 100})  # a second reveal cannot re-score it
        assert p.predicted == 100

    _run(scenario)
