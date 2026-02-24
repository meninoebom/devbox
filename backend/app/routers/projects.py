"""Project CRUD with file upload for the Form Workshop."""

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectRead

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
async def list_projects(db: AsyncSession = Depends(get_db)):
    """List all projects."""
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    name: str = Form(...),
    description: str | None = Form(None),
    tags: str | None = Form(None),
    cover_image: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a project with optional cover image upload (multipart form data).

    Tags should be a JSON-encoded array of strings, e.g. '["python", "fastapi"]'.
    """
    image_path = None
    if cover_image and cover_image.filename:
        upload_dir = Path(settings.UPLOAD_DIR)
        upload_dir.mkdir(parents=True, exist_ok=True)
        ext = Path(cover_image.filename).suffix
        filename = f"{uuid.uuid4().hex}{ext}"
        dest = upload_dir / filename
        dest.write_bytes(await cover_image.read())
        image_path = f"/uploads/{filename}"

    project = Project(
        name=name,
        description=description,
        tags=tags,
        cover_image_path=image_path,
        owner_id=user.id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single project by ID."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
