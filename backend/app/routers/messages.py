"""Full CRUD for messages — the Data Pipeline workshop's primary entity."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.message import Message
from app.schemas.message import MessageCreate, MessageRead, MessageUpdate

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("", response_model=list[MessageRead])
async def list_messages(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
):
    """List messages with pagination. Returns an array ordered by newest first."""
    offset = (page - 1) * limit
    result = await db.execute(
        select(Message).order_by(Message.created_at.desc()).offset(offset).limit(limit)
    )
    return result.scalars().all()


@router.get("/{message_id}", response_model=MessageRead)
async def get_message(message_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single message by ID."""
    msg = await db.get(Message, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return msg


@router.post("", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def create_message(data: MessageCreate, db: AsyncSession = Depends(get_db)):
    """Create a new message. Demonstrates Pydantic validation on input."""
    msg = Message(**data.model_dump())
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.put("/{message_id}", response_model=MessageRead)
async def update_message(
    message_id: int, data: MessageUpdate, db: AsyncSession = Depends(get_db)
):
    """Update an existing message. Only provided fields are changed."""
    msg = await db.get(Message, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(msg, key, value)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(message_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a message by ID."""
    msg = await db.get(Message, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    await db.delete(msg)
    await db.commit()
