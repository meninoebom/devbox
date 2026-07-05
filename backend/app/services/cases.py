"""Case-file lifecycle: file a question -> investigate world-1 -> advance (seed a
different world-2) -> port the fix (win-checked) -> close with an explain-back.

The two-context rule has teeth: close() refuses until the principle was both solved
in world-1 and ported to world-2, and world-2 is a different surface than world-1.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case_file import CaseFile
from app.services import lab_runner, world_seeder
from app.services.assertions import evaluate, metrics_from_run
from app.services.faults import FAMILIES
from app.services.plan_parser import parse

SCALE = 50_000


class TwoContextRequiredError(Exception):
    """Raised when a case tries to close before it has been solved in both worlds."""


def _run_view(res, plan) -> dict:
    return {
        "specimen_up": res.specimen_up,
        "error": res.error,
        "columns": res.columns,
        "rows": res.rows,
        "row_count": res.row_count,
        "duration_ms": res.duration_ms,
        "plan": plan,
    }


async def _run(schema: str, sql: str, setup_sql: str | None = None) -> dict:
    res = await lab_runner.run(sql, setup_sql=setup_sql, schema=schema)
    plan = parse(res.explain_json) if (res.specimen_up and not res.error) else None
    return _run_view(res, plan)


async def create(db: AsyncSession, title: str, question: str) -> dict:
    c = CaseFile(
        title=title, question=question, schema_1="pending", template_1="books", status="open"
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    c.schema_1 = f"case_{c.id}_a"
    await world_seeder.create_world(c.schema_1, SCALE, template="books")
    await db.commit()
    await db.refresh(c)
    symptom = await _run(c.schema_1, world_seeder.probe_query("books"))
    return {"case": _view(c), "probe": world_seeder.probe_query("books"), "symptom": symptom}


async def investigate(db: AsyncSession, case: CaseFile, sql: str, setup_sql: str | None) -> dict:
    schema = case.schema_2 if case.status == "advanced" and case.schema_2 else case.schema_1
    return await _run(schema, sql, setup_sql)


async def advance(db: AsyncSession, case: CaseFile, note: str) -> dict:
    case.context1_solved = True
    case.context1_note = note
    case.schema_2 = f"case_{case.id}_b"
    case.template_2 = "sensors"
    case.status = "advanced"
    await world_seeder.create_world(case.schema_2, SCALE, template="sensors")
    await db.commit()
    symptom = await _run(case.schema_2, world_seeder.probe_query("sensors"))
    return {"case": _view(case), "probe": world_seeder.probe_query("sensors"), "symptom": symptom}


async def port(db: AsyncSession, case: CaseFile, fix_sql: str, note: str | None = None) -> dict:
    if not case.schema_2:
        return {"specimen_up": True, "ported": False, "error": "advance to world-2 first"}
    probe = world_seeder.probe_query("sensors")
    res = await lab_runner.run(probe, setup_sql=fix_sql, schema=case.schema_2)
    if not res.specimen_up:
        return {"specimen_up": False}
    if res.error:
        return {"specimen_up": True, "ported": False, "error": res.error}
    plan = parse(res.explain_json)
    subject = metrics_from_run({"row_count": res.row_count, "duration_ms": res.duration_ms}, plan)
    win = evaluate(FAMILIES["missing_index"].win, subject)
    if win.passed:
        case.context2_solved = True
        case.context2_note = note
        await db.commit()
    return {"specimen_up": True, "ported": win.passed, "detail": win.detail, "plan": plan}


async def close(db: AsyncSession, case: CaseFile, explain_back: str) -> dict:
    if not (case.context1_solved and case.context2_solved):
        raise TwoContextRequiredError(
            "solve the principle in world-1 and port it to world-2 before closing"
        )
    case.explain_back = explain_back
    case.status = "closed"
    case.closed_at = datetime.now(UTC)
    await db.commit()
    return {"closed": True, "case": _view(case)}


def _view(c: CaseFile) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "question": c.question,
        "principle": c.principle,
        "status": c.status,
        "template_1": c.template_1,
        "template_2": c.template_2,
        "context1_solved": c.context1_solved,
        "context2_solved": c.context2_solved,
        "explain_back": c.explain_back,
    }
