"""Round generation + scoring. A round is a fault family instantiated into a fresh
schema; a submission runs the player's fix in that schema and the WIN is decided by
the assertion engine (never ad-hoc). Score is delta-from-par on named axes.
"""

from __future__ import annotations

import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.round import Round
from app.services import lab_runner, world_seeder
from app.services.assertions import AssertionSpec, evaluate, metrics_from_run
from app.services.faults import FAMILIES
from app.services.plan_parser import parse

DEFAULT_SCALE = 50_000


async def generate(
    db: AsyncSession, fmt: str = "regression", family: str | None = None, scale: int = DEFAULT_SCALE
) -> dict:
    fam_id = family if family in FAMILIES else random.choice(list(FAMILIES))
    fam = FAMILIES[fam_id]

    r = Round(
        family=fam_id,
        fmt=fmt,
        schema_name="pending",
        scale=scale,
        baseline_query=fam.baseline_query,
        win_target=fam.win.target,
        win_op=fam.win.op,
        win_value=fam.win.value,
        par_changes=fam.par_changes,
        par_note=fam.par_note,
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)

    schema = f"round_{r.id}"
    await world_seeder.create_world(schema, scale)
    r.schema_name = schema

    # Baseline run is the symptom the player sees; for Target, set a goal from it.
    base = await lab_runner.run(fam.baseline_query, schema=schema)
    base_plan = parse(base.explain_json) if (base.specimen_up and not base.error) else None
    if fmt == "target" and base.duration_ms:
        r.target_ms = round(base.duration_ms / 5, 3)
    await db.commit()
    await db.refresh(r)

    return {
        "id": r.id,
        "family": r.family,
        "fmt": r.fmt,
        "description": fam.description,
        "baseline_query": r.baseline_query,
        "target_ms": r.target_ms,
        "symptom": {
            "specimen_up": base.specimen_up,
            "error": base.error,
            "exec_ms": base.duration_ms,
            "plan": base_plan,
        },
    }


async def submit(db: AsyncSession, r: Round, fix_sql: str, query: str | None = None) -> dict:
    q = query or r.baseline_query
    res = await lab_runner.run(q, setup_sql=fix_sql, schema=r.schema_name)
    if not res.specimen_up:
        return {"specimen_up": False, "error": res.error}
    if res.error:
        return {"specimen_up": True, "won": False, "error": res.error}

    plan = parse(res.explain_json)
    subject = metrics_from_run({"row_count": res.row_count, "duration_ms": res.duration_ms}, plan)
    win = evaluate(AssertionSpec(target=r.win_target, op=r.win_op, value=r.win_value), subject)

    changes = len([s for s in (fix_sql or "").split(";") if s.strip()])
    target_ok = True
    if r.fmt == "target" and r.target_ms is not None:
        target_ok = (res.duration_ms or 1e9) <= r.target_ms
    won = win.passed and target_ok

    if won:
        if not r.solved:
            r.solved = True
            r.solved_at = datetime.now(UTC)
            r.best_changes = changes
        elif r.best_changes is None or changes < r.best_changes:
            r.best_changes = changes
        await db.commit()

    return {
        "specimen_up": True,
        "won": won,
        "win_detail": win.detail,
        "changes": changes,
        "par_changes": r.par_changes,
        "delta": changes - r.par_changes,
        "exec_ms": res.duration_ms,
        "target_ms": r.target_ms,
        "target_ok": target_ok,
        "rows": res.row_count,
        "plan": plan,
        "best_changes": r.best_changes,
        "par_note": r.par_note if won else None,  # the intended fix, revealed on a win
    }


async def cadence(db: AsyncSession) -> dict:
    reps = (await db.execute(select(func.count()).where(Round.solved.is_(True)))).scalar_one()
    since = datetime.now(UTC) - timedelta(days=14)
    recent = (
        await db.execute(
            select(func.count()).where(Round.solved.is_(True), Round.solved_at >= since)
        )
    ).scalar_one()
    return {"reps": reps, "cadence_14d": recent}
