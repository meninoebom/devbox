"""DevBox API — an interactive engineering playground that teaches how web apps work."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine
from app.middleware.cors import add_cors_middleware
from app.middleware.tracing import TracingMiddleware
from app.models import Base
from app.routers import (
    auth,
    mechanic,
    messages,
    meta,
    predictions,
    projects,
    reps,
    rounds,
    slots,
    traces,
    wager,
    workbench,
    workshop_http,
    workshop_types,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="DevBox API",
    description=(
        "An interactive engineering playground that teaches how modern web apps work "
        "by exposing its own internals. Every endpoint is designed to be inspected, "
        "experimented with, and broken."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# --- Middleware (order matters: last added = first executed) ---
add_cors_middleware(app)
app.add_middleware(TracingMiddleware)

# --- Static files for uploads ---
upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

# --- Routers ---
app.include_router(messages.router)
app.include_router(traces.router)
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(workshop_http.router)
app.include_router(workshop_types.router)
app.include_router(meta.router)
app.include_router(workbench.router)
app.include_router(predictions.router)
app.include_router(wager.router)
app.include_router(mechanic.router)
app.include_router(rounds.router)
app.include_router(reps.router)
app.include_router(slots.router)


@app.get("/", tags=["root"])
async def root():
    """API overview — lists available workshop areas and key endpoints."""
    return {
        "name": "DevBox API",
        "version": "0.1.0",
        "workshops": {
            "data_pipeline": "/api/messages — Full CRUD with request tracing",
            "inspector": "/api/traces — View captured request traces",
            "auth_lab": "/api/auth — JWT registration, login, token inspection",
            "form_workshop": "/api/projects — File upload and multipart forms",
            "http_observatory": "/api/workshop/http — Echo, status codes, delays, negotiation",
            "type_bridge": "/api/workshop/types — Schema comparison, validation, type coercion",
            "meta": "/api/meta — Source code, routes, and model introspection",
        },
        "docs": "/docs",
    }
