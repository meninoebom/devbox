"""Request tracing middleware — the heart of the DevBox inspector.

Intercepts every request, captures method/path/headers/body, times the
request, captures SQL queries via the context-var in database.py, and stores
everything as a Trace (kind=request) with one http event plus one sql event
per query. The Trace/TraceEvent model is the same board the Workbench writes to.
"""

import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.database import async_session_factory, captured_queries
from app.models.trace import Lane, TraceKind
from app.services.trace_store import EventSpec, record_trace


class TracingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Skip tracing for the traces endpoints themselves to avoid infinite recursion.
        if request.url.path.startswith("/api/traces"):
            return await call_next(request)

        # --- Capture request ---
        method = request.method
        path = request.url.path
        query = str(request.query_params) if request.query_params else None
        req_headers = dict(request.headers)

        try:
            body_bytes = await request.body()
            req_body = body_bytes.decode("utf-8", errors="replace") if body_bytes else None
        except Exception:
            req_body = None

        # Start SQL capture
        query_bucket: list[dict] = []
        token = captured_queries.set(query_bucket)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            duration = (time.perf_counter() - start) * 1000
            captured_queries.reset(token)

        # --- Capture response body ---
        resp_body_parts: list[bytes] = []
        async for chunk in response.body_iterator:  # type: ignore[attr-defined]
            resp_body_parts.append(chunk if isinstance(chunk, bytes) else chunk.encode())
        resp_body_bytes = b"".join(resp_body_parts)
        resp_body = resp_body_bytes.decode("utf-8", errors="replace")

        # --- Build the event lanes: one http span, one sql span per query ---
        events = [
            EventSpec(
                lane=Lane.HTTP,
                offset_ms=0.0,
                duration_ms=round(duration, 2),
                detail={
                    "method": method,
                    "path": path,
                    "query_params": query,
                    "request_headers": req_headers,
                    "request_body": req_body,
                    "response_status": response.status_code,
                    "response_headers": dict(response.headers),
                    "response_body": resp_body[:10000],  # cap stored body
                },
            )
        ]
        for q in query_bucket:
            events.append(
                EventSpec(
                    lane=Lane.SQL,
                    duration_ms=q.get("duration_ms"),
                    detail={"sql": q.get("sql", ""), "params": q.get("params")},
                )
            )

        # --- Store trace ---
        try:
            async with async_session_factory() as session:
                trace = await record_trace(
                    session,
                    kind=TraceKind.REQUEST,
                    label=f"{method} {path}",
                    duration_ms=round(duration, 2),
                    events=events,
                )
                trace_id = trace.id
        except Exception:
            trace_id = None

        # --- Rebuild response with X-Trace-Id header ---
        headers = dict(response.headers)
        if trace_id is not None:
            headers["X-Trace-Id"] = str(trace_id)

        return Response(
            content=resp_body_bytes,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )
