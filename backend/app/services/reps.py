"""Rep lifecycle: create -> predict (gated) -> reflect (+ homebase-log). The gate is
the frozen discipline from rep.py: no advancing to reflect without a committed
prediction. The prediction is a real sealed Prediction, so the Big-O is immutable.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.rep import Rep
from app.services.predictions import seal


class PredictionRequiredError(Exception):
    """Raised when a rep tries to advance to reflect without a committed prediction."""


async def create(db: AsyncSession, topic: str, restate: str | None = None) -> Rep:
    r = Rep(topic=topic, phase="predict", restate=restate)
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r


async def commit_prediction(db: AsyncSession, rep: Rep, big_o: str) -> Rep:
    """Seal the Big-O (immutable) and unlock the code phase."""
    p = await seal(db, target="big_o", predicted=big_o)
    rep.prediction_id = p.id
    rep.big_o = big_o
    rep.phase = "code"
    await db.commit()
    await db.refresh(rep)
    return rep


def write_log(rep: Rep, log_dir: str | None = None) -> Path:
    """Append this rep's section to today's homebase-log file. Path is config."""
    d = Path(log_dir or settings.HOMEBASE_LOG_DIR).expanduser()
    d.mkdir(parents=True, exist_ok=True)
    day = datetime.now(UTC).strftime("%Y-%m-%d")
    f = d / f"{day}.md"
    section = (
        f"\n## gym: devbox / {rep.topic}\n\n"
        f"### Predict\n{rep.big_o}\n\n"
        f"### Reflect\n{rep.reflection or ''}\n"
    )
    with f.open("a", encoding="utf-8") as fh:
        fh.write(section)
    return f


async def reflect(db: AsyncSession, rep: Rep, reflection: str, log_dir: str | None = None) -> dict:
    if rep.prediction_id is None:
        raise PredictionRequiredError("commit a Big-O prediction before reflecting")
    rep.reflection = reflection
    path = write_log(rep, log_dir)
    rep.logged = True
    rep.phase = "done"
    rep.completed_at = datetime.now(UTC)
    await db.commit()
    return {"rep_id": rep.id, "logged": True, "log_path": str(path)}
