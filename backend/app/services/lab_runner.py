"""LabRunner — the safety boundary for arbitrary user SQL against the lab specimen.

Uses asyncpg directly (not the app's SQLAlchemy engine) because the job is to run
raw, user-authored SQL with EXPLAIN, multi-statement setup DDL, and hard guards —
exactly the things an ORM abstraction gets in the way of. Safety comes from four
places: a read-only transaction by default, a server-side statement_timeout, a
result-row cap, and the fact that the lab database is disposable and reseedable.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import asyncpg

from app.config import settings


@dataclass
class RunResult:
    specimen_up: bool
    columns: list[str] = field(default_factory=list)
    rows: list[list[Any]] = field(default_factory=list)
    row_count: int = 0
    truncated: bool = False
    duration_ms: float | None = None  # execution time reported by EXPLAIN ANALYZE
    explain_json: Any | None = None
    error: str | None = None


def _jsonable(value: Any) -> Any:
    """asyncpg returns native Python types; coerce anything non-JSON to a string
    so the result grid always serializes."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


async def run(
    sql: str,
    setup_sql: str | None = None,
    *,
    allow_writes: bool = False,
    dsn: str | None = None,
    timeout_ms: int | None = None,
    row_cap: int | None = None,
) -> RunResult:
    """Run setup DDL (if any) then the query, returning rows, the EXPLAIN ANALYZE
    plan, and timing. Never raises for user SQL errors — they come back on
    `RunResult.error`. Only a missing specimen sets `specimen_up=False`."""
    dsn = dsn or settings.LAB_DSN
    timeout_ms = timeout_ms or settings.LAB_STATEMENT_TIMEOUT_MS
    row_cap = row_cap or settings.LAB_ROW_CAP

    try:
        conn = await asyncpg.connect(dsn, timeout=3)
    except (OSError, asyncpg.PostgresError, TimeoutError):
        return RunResult(
            specimen_up=False,
            error="Lab specimen is not reachable. Start it with `mise run lab:up`.",
        )

    try:
        await conn.execute(f"SET statement_timeout = {int(timeout_ms)}")

        # Setup DDL (e.g. CREATE INDEX) runs first and commits, so it is in effect
        # for the query and for subsequent runs. asyncpg's execute() allows the
        # multi-statement simple-query protocol here.
        if setup_sql and setup_sql.strip():
            try:
                await conn.execute(setup_sql)
            except asyncpg.PostgresError as e:
                return RunResult(specimen_up=True, error=f"setup: {e}")

        # EXPLAIN ANALYZE runs the query once and returns the real plan with actual
        # rows and timing. Read-only transaction unless writes are explicitly allowed.
        try:
            async with conn.transaction(readonly=not allow_writes):
                explain_val = await conn.fetchval(
                    "EXPLAIN (ANALYZE, FORMAT JSON, BUFFERS) " + sql
                )
        except asyncpg.PostgresError as e:
            return RunResult(specimen_up=True, error=str(e))

        explain_json = (
            explain_val
            if isinstance(explain_val, (list, dict))
            else json.loads(explain_val)
        )

        # Fetch a capped page of rows for the result grid (a second read-only pass;
        # harmless for the SELECTs the Workbench is built around).
        async with conn.transaction(readonly=not allow_writes):
            cursor = await conn.cursor(sql)
            recs = await cursor.fetch(row_cap + 1)

        truncated = len(recs) > row_cap
        recs = recs[:row_cap]
        columns = list(recs[0].keys()) if recs else []
        rows = [[_jsonable(v) for v in r.values()] for r in recs]

        duration_ms = None
        if isinstance(explain_json, list) and explain_json:
            duration_ms = explain_json[0].get("Execution Time")

        return RunResult(
            specimen_up=True,
            columns=columns,
            rows=rows,
            row_count=len(rows),
            truncated=truncated,
            duration_ms=duration_ms,
            explain_json=explain_json,
        )
    except asyncpg.PostgresError as e:
        return RunResult(specimen_up=True, error=str(e))
    finally:
        await conn.close()
