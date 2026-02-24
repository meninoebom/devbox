"""HTTP Observatory — endpoints that teach HTTP concepts by example."""

import asyncio
import json

from fastapi import APIRouter, Body, Query, Request, Response
from pydantic import BaseModel, Field, ValidationError

router = APIRouter(prefix="/api/workshop/http", tags=["workshop-http"])


@router.api_route("/echo", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def echo(request: Request):
    """Echoes back the full request as the response.

    Accepts any HTTP method. Returns method, headers, query params, and body
    so you can see exactly what the server received.
    """
    body = None
    try:
        body_bytes = await request.body()
        body = body_bytes.decode("utf-8", errors="replace") if body_bytes else None
    except Exception:
        pass

    return {
        "method": request.method,
        "path": str(request.url.path),
        "query_params": dict(request.query_params),
        "headers": dict(request.headers),
        "body": body,
    }


HTTP_STATUS_EXPLANATIONS = {
    200: "OK — The request succeeded.",
    201: "Created — A new resource was created.",
    204: "No Content — Success, but nothing to return.",
    301: "Moved Permanently — This resource has a new URL forever.",
    302: "Found — Temporary redirect to another URL.",
    304: "Not Modified — Cached version is still valid.",
    400: "Bad Request — The server couldn't understand the request.",
    401: "Unauthorized — Authentication is required.",
    403: "Forbidden — You don't have permission.",
    404: "Not Found — The resource doesn't exist.",
    405: "Method Not Allowed — This HTTP method isn't supported here.",
    409: "Conflict — The request conflicts with current state.",
    418: "I'm a Teapot — An April Fools' joke from 1998 (RFC 2324).",
    422: "Unprocessable Entity — The request body failed validation.",
    429: "Too Many Requests — Rate limit exceeded.",
    500: "Internal Server Error — Something went wrong on the server.",
    502: "Bad Gateway — The upstream server sent an invalid response.",
    503: "Service Unavailable — The server is temporarily overloaded.",
}


@router.get("/status/{code}")
async def status_code(code: int):
    """Returns whatever HTTP status code you ask for, with an explanation.

    Try /status/200, /status/404, /status/418, etc.
    """
    explanation = HTTP_STATUS_EXPLANATIONS.get(code, "Non-standard or unknown status code.")
    return Response(
        content=json.dumps({"status_code": code, "explanation": explanation}),
        status_code=code if 100 <= code <= 599 else 200,
        media_type="application/json",
    )


@router.get("/slow")
async def slow(delay: float = Query(1.0, ge=0, le=10, description="Seconds to wait")):
    """Artificial delay to demonstrate loading states and timeouts.

    The response includes the actual delay so you can compare with what
    the browser's network tab reports.
    """
    await asyncio.sleep(delay)
    return {"requested_delay_seconds": delay, "message": f"Responded after {delay}s"}


@router.get("/content-types")
async def content_types(request: Request):
    """Returns the same data in different formats based on the Accept header.

    - `application/json` (default) — JSON object
    - `text/html` — HTML snippet
    - `text/plain` — plain text
    - `application/xml` — XML
    """
    data = {"greeting": "Hello from DevBox", "framework": "FastAPI", "year": 2026}
    accept = request.headers.get("accept", "application/json")

    if "text/html" in accept:
        html = "<dl>" + "".join(f"<dt>{k}</dt><dd>{v}</dd>" for k, v in data.items()) + "</dl>"
        return Response(content=html, media_type="text/html")
    if "text/plain" in accept:
        text = "\n".join(f"{k}: {v}" for k, v in data.items())
        return Response(content=text, media_type="text/plain")
    if "application/xml" in accept:
        xml = "<data>" + "".join(f"<{k}>{v}</{k}>" for k, v in data.items()) + "</data>"
        return Response(content=xml, media_type="application/xml")

    return data


class SampleBody(BaseModel):
    """A sample body schema used by the validation endpoint."""

    name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=0, le=150)
    email: str = Field(..., pattern=r"^[\w.+-]+@[\w-]+\.[\w.]+$")
    tags: list[str] = Field(default_factory=list)


@router.post("/validate-body")
async def validate_body(body: dict = Body(...)):
    """Accepts arbitrary JSON and validates it against a sample Pydantic model.

    Returns detailed validation results showing which fields passed,
    which failed, and what Pydantic's error messages look like.
    """
    try:
        validated = SampleBody(**body)
        return {
            "valid": True,
            "parsed": validated.model_dump(),
            "schema": SampleBody.model_json_schema(),
        }
    except ValidationError as exc:
        return {
            "valid": False,
            "errors": exc.errors(),
            "input": body,
            "schema": SampleBody.model_json_schema(),
        }
