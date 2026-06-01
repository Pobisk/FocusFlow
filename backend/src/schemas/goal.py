"""Pydantic schemas for Goal module."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class GoalStatusRead(BaseModel):
    """Схема для чтения статуса цели из справочника."""

    id: int
    code: str
    name: str
    sort_order: int
    color: Optional[str] = None

    model_config = {"from_attributes": True}


class GoalRead(BaseModel):
    """Схема для чтения цели."""

    id: UUID
    sphere_id: UUID
    sphere_code: str
    sphere_name: str
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    status_id: int
    status_code: str
    status_name: str
    status_color: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GoalCreate(BaseModel):
    """Схема для создания цели."""

    sphere_id: UUID
    title: str = Field(..., max_length=300)
    description: Optional[str] = Field(default=None, max_length=2000)
    deadline: Optional[datetime] = None


class GoalUpdate(BaseModel):
    """Схема для обновления цели."""

    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = Field(default=None, max_length=2000)
    deadline: Optional[datetime] = None
    status_id: Optional[int] = None  # 1-активна, 2-завершена, 3-отменена
    sphere_id: Optional[UUID] = None
