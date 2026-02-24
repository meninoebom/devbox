"""Type Bridge endpoints — explore the relationship between Python types,
Pydantic schemas, SQLAlchemy models, and TypeScript types."""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field, ValidationError

from app.models.message import Message
from app.models.project import Project
from app.models.user import User
from app.schemas.message import MessageCreate, MessageRead
from app.schemas.project import ProjectCreate, ProjectRead
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/api/workshop/types", tags=["workshop-types"])

# Map of model names to their Pydantic schemas
_SCHEMAS = {
    "MessageCreate": MessageCreate,
    "MessageRead": MessageRead,
    "ProjectCreate": ProjectCreate,
    "ProjectRead": ProjectRead,
    "UserCreate": UserCreate,
    "UserRead": UserRead,
}

# Map of model names to SQLAlchemy models
_SA_MODELS = {
    "Message": Message,
    "Project": Project,
    "User": User,
}


def _sa_columns(model) -> list[dict]:
    """Extract column info from a SQLAlchemy model."""
    cols = []
    for col in model.__table__.columns:
        cols.append(
            {
                "name": col.name,
                "type": str(col.type),
                "nullable": col.nullable,
                "primary_key": col.primary_key,
                "default": str(col.default) if col.default else None,
            }
        )
    return cols


@router.get("/schema")
async def get_schemas():
    """Returns the JSON Schema (OpenAPI-compatible) for key Pydantic models.

    This is the same schema that drives OpenAPI docs — and can generate
    TypeScript types via openapi-typescript.
    """
    return {name: schema.model_json_schema() for name, schema in _SCHEMAS.items()}


@router.post("/validate")
async def validate_data(model_name: str = Query(..., description="Pydantic schema name"), body: dict = {}):
    """Send any JSON payload and get back detailed Pydantic validation results.

    Shows coercion (e.g. string "42" → int 42), missing fields, type errors, etc.
    """
    schema_cls = _SCHEMAS.get(model_name)
    if not schema_cls:
        return {"error": f"Unknown model. Choose from: {list(_SCHEMAS.keys())}"}
    try:
        result = schema_cls(**body)
        return {"valid": True, "parsed": result.model_dump(mode="json"), "input": body}
    except ValidationError as exc:
        return {"valid": False, "errors": exc.errors(), "input": body}


@router.get("/compare")
async def compare_types():
    """Shows Pydantic model vs SQLAlchemy model side by side.

    Demonstrates how the same 'entity' is represented differently
    at the validation layer vs the persistence layer.
    """
    comparisons = {}
    mapping = {"Message": ("MessageRead", Message), "Project": ("ProjectRead", Project), "User": ("UserRead", User)}
    for entity, (schema_name, sa_model) in mapping.items():
        comparisons[entity] = {
            "pydantic_schema": _SCHEMAS[schema_name].model_json_schema(),
            "sqlalchemy_columns": _sa_columns(sa_model),
            "table_name": sa_model.__tablename__,
        }
    return comparisons


@router.get("/query-params-demo")
async def query_params_demo(
    name: str = Query("world", description="A string parameter"),
    age: int = Query(25, description="An integer — notice string→int coercion"),
    active: bool = Query(True, description="A boolean — try 'true', '1', 'yes'"),
    score: float = Query(9.5, description="A float parameter"),
):
    """Demonstrates how FastAPI/Pydantic coerces query parameter types.

    Try passing `?age=abc` to see a validation error, or `?active=yes` to see
    boolean coercion in action.
    """
    return {
        "received": {"name": name, "age": age, "active": active, "score": score},
        "types": {
            "name": type(name).__name__,
            "age": type(age).__name__,
            "active": type(active).__name__,
            "score": type(score).__name__,
        },
    }
