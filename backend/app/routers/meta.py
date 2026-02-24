"""Self-describing endpoints — the app inspects and explains itself."""

import inspect
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from app.models.message import Message
from app.models.project import Project
from app.models.request_trace import RequestTrace
from app.models.user import User

router = APIRouter(prefix="/api/meta", tags=["meta"])

APP_DIR = Path(__file__).resolve().parent.parent  # backend/app/


def _sa_columns(model) -> list[dict]:
    cols = []
    for col in model.__table__.columns:
        cols.append(
            {
                "name": col.name,
                "type": str(col.type),
                "nullable": col.nullable,
                "primary_key": col.primary_key,
            }
        )
    return cols


@router.get("/source/{path:path}")
async def get_source(path: str):
    """Returns the actual Python source code of a module within the app/ directory.

    Example: `/api/meta/source/routers/messages.py`

    Sandboxed to only read files inside the `app/` directory — no escaping
    to read arbitrary system files.
    """
    target = (APP_DIR / path).resolve()
    if not str(target).startswith(str(APP_DIR)):
        raise HTTPException(status_code=403, detail="Access denied — path outside app/")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    if not target.suffix == ".py":
        raise HTTPException(status_code=400, detail="Only .py files can be read")

    return {"path": path, "source": target.read_text(encoding="utf-8")}


@router.get("/routes")
async def list_routes(request: Request):
    """Lists all registered API routes with methods, parameters, and response models.

    This reads from FastAPI's own route registry — the same data that
    generates the OpenAPI spec.
    """
    routes = []
    for route in request.app.routes:
        if hasattr(route, "methods"):
            routes.append(
                {
                    "path": route.path,
                    "methods": sorted(route.methods - {"HEAD", "OPTIONS"}),
                    "name": route.name,
                    "summary": getattr(route, "summary", None)
                    or (route.endpoint.__doc__ or "").split("\n")[0].strip(),
                    "tags": getattr(route, "tags", []),
                }
            )
    return sorted(routes, key=lambda r: r["path"])


@router.get("/models")
async def list_models():
    """Returns all SQLAlchemy model definitions with their columns.

    Shows the database schema that backs the application — useful for
    understanding how Pydantic schemas map to database tables.
    """
    models = {
        "Message": {"table": Message.__tablename__, "columns": _sa_columns(Message)},
        "User": {"table": User.__tablename__, "columns": _sa_columns(User)},
        "Project": {"table": Project.__tablename__, "columns": _sa_columns(Project)},
        "RequestTrace": {"table": RequestTrace.__tablename__, "columns": _sa_columns(RequestTrace)},
    }
    return models
