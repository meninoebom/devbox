"""Spec gate (offline parts): the two-context rule is structural — a case cannot
close until both worlds are solved — and the two worlds are different surfaces."""

import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models  # noqa: F401  (register tables)
from app.models.base import Base
from app.models.case_file import CaseFile
from app.services import cases, world_seeder


def _run(make_coro):
    async def wrap():
        engine = create_async_engine("sqlite+aiosqlite://")
        async with engine.begin() as c:
            await c.run_sync(Base.metadata.create_all)
        sf = async_sessionmaker(engine, expire_on_commit=False)
        async with sf() as s:
            return await make_coro(s)

    return asyncio.run(wrap())


def test_close_requires_both_contexts():
    async def scenario(s):
        c = CaseFile(title="cache?", question="q", schema_1="x", template_1="books", status="open")
        s.add(c)
        await s.commit()
        await s.refresh(c)

        # neither solved -> refuse
        with pytest.raises(cases.TwoContextRequiredError):
            await cases.close(s, c, "reads dominate writes")

        # only world-1 -> still refuse (this is the whole point of two contexts)
        c.context1_solved = True
        await s.commit()
        with pytest.raises(cases.TwoContextRequiredError):
            await cases.close(s, c, "reads dominate writes")

        # both -> allowed
        c.context2_solved = True
        await s.commit()
        out = await cases.close(s, c, "a cache helps when reads dominate and keys are few")
        assert out["closed"] is True

    _run(scenario)


def test_the_two_worlds_are_different_surfaces():
    assert "books" in world_seeder.WORLDS
    assert "sensors" in world_seeder.WORLDS
    assert world_seeder.probe_query("books") != world_seeder.probe_query("sensors")
    # same principle (an unindexed FK filter), different tables
    assert "books" in world_seeder.probe_query("books")
    assert "readings" in world_seeder.probe_query("sensors")
