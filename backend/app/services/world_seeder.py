"""Seed a world into its own Postgres schema, isolated from the Workbench and from
other rounds/cases. Multiple templates share the same missing-index principle on a
different surface, which is what lets case files enforce the two-context rule.
"""

from __future__ import annotations

import asyncpg

from app.config import settings
from app.services.faults import WORLD_DDL as BOOKS_DDL
from app.services.faults import world_dml as books_dml

# A second surface: sensors + readings, same "unindexed FK lookup" shape as books.
SENSORS_DDL = """
CREATE TABLE sensors (
    id serial PRIMARY KEY,
    name text NOT NULL,
    location text NOT NULL
);
CREATE TABLE readings (
    id serial PRIMARY KEY,
    sensor_id integer NOT NULL REFERENCES sensors (id),
    value numeric(8, 3) NOT NULL,
    taken_at timestamptz NOT NULL DEFAULT now()
);
"""


def sensors_dml(scale: int) -> str:
    n_sensors = max(50, scale // 20)
    return f"""
    INSERT INTO sensors (name, location)
    SELECT 'Sensor ' || g, (ARRAY['roof','lab','yard','hall'])[1 + (g % 4)]
    FROM generate_series(1, {n_sensors}) g;

    INSERT INTO readings (sensor_id, value)
    SELECT 1 + (g % {n_sensors}), ((g % 1000) + 0.5)::numeric(8,3)
    FROM generate_series(1, {scale}) g;

    ANALYZE sensors;
    ANALYZE readings;
    """


WORLDS = {
    "books": {
        "ddl": BOOKS_DDL,
        "dml": books_dml,
        "probe": "SELECT id, title FROM books WHERE author_id = 7",
    },
    "sensors": {
        "ddl": SENSORS_DDL,
        "dml": sensors_dml,
        "probe": "SELECT id, value FROM readings WHERE sensor_id = 7",
    },
}


async def create_world(
    schema: str, scale: int, template: str = "books", dsn: str | None = None
) -> None:
    world = WORLDS.get(template, WORLDS["books"])
    conn = await asyncpg.connect(dsn or settings.LAB_DSN, timeout=5)
    try:
        await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        await conn.execute(f'CREATE SCHEMA "{schema}"')
        await conn.execute(f'SET search_path TO "{schema}"')
        await conn.execute(world["ddl"])
        await conn.execute(world["dml"](scale))
    finally:
        await conn.close()


def probe_query(template: str) -> str:
    return WORLDS.get(template, WORLDS["books"])["probe"]


async def drop_world(schema: str, dsn: str | None = None) -> None:
    conn = await asyncpg.connect(dsn or settings.LAB_DSN, timeout=5)
    try:
        await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
    finally:
        await conn.close()
