"""The data-floor fault taxonomy — the generative source of puzzles.

A FaultFamily is a parameterized pathology: it knows how to seed a world, the
symptom query, the assertion its BROKEN state satisfies (its signature), the
assertion that means FIXED (the win), and the minimal fix (par). No level is
hand-authored; a round is a family instantiated into a fresh schema at some scale.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.assertions import AssertionSpec

# One world template for now: authors + books, no secondary indexes. The faults
# differ in which query hurts and which index fixes it.
WORLD_DDL = """
CREATE TABLE authors (
    id serial PRIMARY KEY,
    name text NOT NULL,
    country text NOT NULL
);
CREATE TABLE books (
    id serial PRIMARY KEY,
    author_id integer NOT NULL REFERENCES authors (id),
    title text NOT NULL,
    genre text NOT NULL,
    published_year integer NOT NULL,
    price numeric(6, 2) NOT NULL
);
"""


def world_dml(scale: int) -> str:
    n_authors = max(50, scale // 20)
    return f"""
    INSERT INTO authors (name, country)
    SELECT 'Author ' || g, (ARRAY['US','UK','FR','DE'])[1 + (g % 4)]
    FROM generate_series(1, {n_authors}) g;

    INSERT INTO books (author_id, title, genre, published_year, price)
    SELECT 1 + (g % {n_authors}), 'Book ' || g,
           (ARRAY['fiction','history','science','tech'])[1 + (g % 4)],
           1950 + (g % 75), (5 + (g % 40))::numeric(6,2)
    FROM generate_series(1, {scale}) g;

    ANALYZE authors;
    ANALYZE books;
    """


@dataclass(frozen=True)
class FaultFamily:
    id: str
    description: str
    baseline_query: str
    signature: AssertionSpec  # true in the BROKEN state (used to prove the injector)
    win: AssertionSpec  # true when FIXED
    par_changes: int
    par_note: str


FAMILIES: dict[str, FaultFamily] = {
    "missing_index": FaultFamily(
        id="missing_index",
        description="A filtered lookup with no index on the filter column scans the whole table.",
        baseline_query="SELECT id, title FROM books WHERE author_id = 7",
        signature=AssertionSpec(target="plan.has_seq_scan", op="eq", value=True),
        win=AssertionSpec(target="plan.uses_index", op="eq", value=True),
        par_changes=1,
        par_note="CREATE INDEX ON books (author_id)",
    ),
    "unindexed_sort": FaultFamily(
        id="unindexed_sort",
        description="A filter plus ORDER BY with no supporting index scans then sorts.",
        baseline_query="SELECT id, title FROM books WHERE genre = 'tech' ORDER BY published_year",
        signature=AssertionSpec(target="plan.has_seq_scan", op="eq", value=True),
        win=AssertionSpec(target="plan.uses_index", op="eq", value=True),
        par_changes=1,
        par_note="CREATE INDEX ON books (genre, published_year)",
    ),
}
