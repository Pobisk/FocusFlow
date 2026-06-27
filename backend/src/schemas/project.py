"""Pydantic schemas for Project module."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class ProjectStatusRead(BaseModel):
    """Схема для чтения статуса проекта из справочника."""

    id: int
    code: str
    name: str
    sort_order: int
    color: Optional[str] = None

    model_config = {"from_attributes": True}


class ProjectRead(BaseModel):
    """Схема для чтения проекта."""

    id: UUID
    sphere_id: UUID
    sphere_code: str
    sphere_name: str
    goal_id: Optional[UUID] = None
    goal_title: Optional[str] = None
    title: str
    description: Optional[str] = None
    start_date: datetime
    finish_date: datetime
    status_id: int
    status_code: str
    status_name: str
    status_color: Optional[str] = None
    progress: int
    # Вычисляемые поля
    has_active_task: bool = False
    speed: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    """Схема для создания проекта."""

    sphere_id: UUID
    goal_id: Optional[UUID] = None
    title: str = Field(..., max_length=300)
    description: Optional[str] = Field(default=None, max_length=5000)
    start_date: datetime
    finish_date: datetime
    progress: int = Field(default=0, ge=0, le=100)


class ProjectUpdate(BaseModel):
    """Схема для обновления проекта."""

    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = Field(default=None, max_length=5000)
    start_date: Optional[datetime] = None
    finish_date: Optional[datetime] = None
    status_id: Optional[int] = None  # 1-активен, 2-завершён, 3-отменён
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    sphere_id: Optional[UUID] = None
    goal_id: Optional[UUID] = None
