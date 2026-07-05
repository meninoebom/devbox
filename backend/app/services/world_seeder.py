"""Seed a round's world into its own Postgres schema, isolated from the Workbench
and from other rounds. Disposable by design: a round drops and recreates its schema.
"""

from __future__ import annotations

import asyncpg

from app.config import settings
from app.services.faults import WORLD_DDL, world_dml


async def create_world(schema: str, scale: int, dsn: str | None = None) -> None:
    conn = await asyncpg.connect(dsn or settings.LAB_DSN, timeout=5)
    try:
        await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        await conn.execute(f'CREATE SCHEMA "{schema}"')
        await conn.execute(f'SET search_path TO "{schema}"')
        await conn.execute(WORLD_DDL)
        await conn.execute(world_dml(scale))
    finally:
        await conn.close()


async def drop_world(schema: str, dsn: str | None = None) -> None:
    conn = await asyncpg.connect(dsn or settings.LAB_DSN, timeout=5)
    try:
        await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
    finally:
        await conn.close()
