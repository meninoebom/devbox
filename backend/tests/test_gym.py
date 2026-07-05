"""Spec gate: the rep predict-gate, the homebase-log writer, the slot benchmark,
and the no-streak invariant."""

import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models  # noqa: F401  (register tables)
from app.models.base import Base
from app.models.slot_impl import SlotImpl
from app.services import reps, slots

CORRECT_LRU = """
class Cache:
    def __init__(self, capacity):
        self.cap = capacity
        self.d = OrderedDict()
    def get(self, key):
        if key not in self.d:
            return None
        self.d.move_to_end(key)
        return self.d[key]
    def set(self, key, value):
        if key in self.d:
            self.d.move_to_end(key)
        self.d[key] = value
        if len(self.d) > self.cap:
            self.d.popitem(last=False)
"""

WRONG_UNBOUNDED = """
class Cache:
    def __init__(self, capacity):
        self.d = {}
    def get(self, key):
        return self.d.get(key)
    def set(self, key, value):
        self.d[key] = value
"""


def _run(make_coro):
    async def wrap():
        engine = create_async_engine("sqlite+aiosqlite://")
        async with engine.begin() as c:
            await c.run_sync(Base.metadata.create_all)
        sf = async_sessionmaker(engine, expire_on_commit=False)
        async with sf() as s:
            return await make_coro(s)

    return asyncio.run(wrap())


def test_reflect_requires_a_committed_prediction():
    async def scenario(s):
        r = await reps.create(s, "windowed variance")
        with pytest.raises(reps.PredictionRequiredError):
            await reps.reflect(s, r, "it was linear")  # no Big-O sealed yet

    _run(scenario)


def test_rep_flow_writes_the_log_to_the_configured_path(tmp_path):
    async def scenario(s):
        r = await reps.create(s, "windowed variance")
        await reps.commit_prediction(s, r, "O(n)")
        out = await reps.reflect(s, r, "linear as predicted", log_dir=str(tmp_path))
        assert out["logged"] is True
        files = list(tmp_path.glob("*.md"))
        assert len(files) == 1
        text = files[0].read_text()
        assert "gym: devbox / windowed variance" in text
        assert "O(n)" in text

    _run(scenario)


def test_slot_benchmark_correct_lru_passes():
    result = slots.benchmark_cache(CORRECT_LRU)
    assert result.correct is True


def test_slot_benchmark_wrong_cache_fails():
    result = slots.benchmark_cache(WRONG_UNBOUNDED)
    assert result.correct is False  # never evicts -> differs from the reference


def test_slot_impl_has_no_streak_column():
    cols = {c.name.lower() for c in SlotImpl.__table__.columns}
    assert not [c for c in cols if "streak" in c or "consecutive" in c]
    assert "last_run_at" in cols  # dust is derived from this, not stored
