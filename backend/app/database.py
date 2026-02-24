"""Async SQLAlchemy engine, session factory, and query capture for tracing."""

from collections.abc import AsyncGenerator
from contextvars import ContextVar

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

# Context var that the tracing middleware populates so captured queries
# end up on the correct request.
captured_queries: ContextVar[list[dict] | None] = ContextVar("captured_queries", default=None)


def _setup_query_capture() -> None:
    """Register a SQLAlchemy event listener on the *sync* engine that records
    every executed statement into the context-var list (if one is active)."""

    sync_engine = engine.sync_engine

    @event.listens_for(sync_engine, "before_cursor_execute")
    def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        # Stash start time on the context so after_cursor_execute can compute duration.
        import time

        conn.info["query_start"] = time.perf_counter()

    @event.listens_for(sync_engine, "after_cursor_execute")
    def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        import time

        duration = (time.perf_counter() - conn.info.pop("query_start", time.perf_counter())) * 1000
        bucket = captured_queries.get()
        if bucket is not None:
            bucket.append(
                {
                    "sql": statement,
                    "params": str(parameters) if parameters else None,
                    "duration_ms": round(duration, 3),
                }
            )


_setup_query_capture()


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with async_session_factory() as session:
        yield session
