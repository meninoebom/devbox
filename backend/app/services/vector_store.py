"""A sqlite-vec vector store (frozen decision: sqlite-vec is the store). Uses its own
synchronous sqlite3 connection with the extension loaded, separate from the app DB.
Small by design — this is a teaching store, not a production index.
"""

from __future__ import annotations

import sqlite3

import sqlite_vec


class VectorStore:
    def __init__(self, dim: int):
        self.dim = dim
        self.db = sqlite3.connect(":memory:")
        self.db.enable_load_extension(True)
        sqlite_vec.load(self.db)
        self.db.enable_load_extension(False)
        self.db.execute(f"CREATE VIRTUAL TABLE chunks USING vec0(embedding float[{dim}])")
        self._texts: dict[int, str] = {}
        self._next = 1

    def add(self, text: str, embedding: list[float]) -> int:
        rid = self._next
        self._next += 1
        self.db.execute(
            "INSERT INTO chunks(rowid, embedding) VALUES (?, ?)",
            [rid, sqlite_vec.serialize_float32(embedding)],
        )
        self._texts[rid] = text
        return rid

    def search(self, embedding: list[float], k: int) -> list[dict]:
        if k <= 0:
            return []
        rows = self.db.execute(
            "SELECT rowid, distance FROM chunks WHERE embedding MATCH ? ORDER BY distance LIMIT ?",
            [sqlite_vec.serialize_float32(embedding), k],
        ).fetchall()
        return [{"rowid": r, "text": self._texts[r], "distance": d} for r, d in rows]

    def close(self) -> None:
        self.db.close()
