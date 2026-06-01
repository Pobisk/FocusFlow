"""Pydantic schemas for Goal module."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class GoalRead(BaseModel):
    """Схема для чтения цели."""

    id: UUID
    sphere_id: UUID
    sphere_code: str  # из join со Sphere
    sphere_name: str
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    status: str
    progress: float  # вычисляемое поле: процент завершённых проектов/задач
    has_active_projects: bool  # есть ли активные проекты/задачи
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
    status: Optional[str] = None  # "active" | "completed" | "cancelled"
    sphere_id: Optional[UUID] = None
