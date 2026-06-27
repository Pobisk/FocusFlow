"""Pydantic схемы для Task."""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


# ── Справочник статусов ───────────────────────────────


class TaskStatusRead(BaseModel):
    """Ответ со статусом задачи из справочника."""

    id: int
    code: str
    name: str
    sort_order: int
    color: str | None

    model_config = {"from_attributes": True}


# ── Задача — чтение ────────────────────────────────────


class TaskRead(BaseModel):
    """Детальная информация по задаче."""

    id: UUID
    sphere_id: UUID
    sphere_code: str
    sphere_name: str
    project_id: UUID | None
    project_title: str | None
    goal_id: UUID | None
    goal_title: str | None
    title: str
    description: str | None

    is_appointment: bool

    start_date: datetime
    finish_date: datetime

    appointment_at: datetime | None
    travel_time: int | None

    duration: int
    importance: int
    consequences: int
    progress: int

    delay_to: datetime | None
    refusal_count: int

    status_id: int
    status_code: str
    status_name: str
    status_color: str | None

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Задача — создание ──────────────────────────────────


class TaskCreate(BaseModel):
    """Создание новой задачи."""

    sphere_id: UUID
    project_id: UUID | None = Field(default=None)
    goal_id: UUID | None = Field(default=None)
    title: str = Field(..., max_length=500)
    description: str | None = Field(default=None, max_length=5000)

    is_appointment: bool = Field(default=False)

    start_date: datetime
    finish_date: datetime

    appointment_at: datetime | None = Field(default=None)
    travel_time: int | None = Field(default=None)

    duration: int = Field(default=30, ge=1)
    importance: int = Field(default=0, ge=0, le=3)
    consequences: int = Field(default=0, ge=0, le=3)
    progress: int = Field(default=0, ge=0, le=100)

    delay_to: datetime | None = Field(default=None)
    refusal_count: int = Field(default=0, ge=0)

    status_id: int = Field(default=1)


# ── Задача — обновление ────────────────────────────────


class TaskUpdate(BaseModel):
    """Обновление задачи. Только переданные поля будут изменены."""

    title: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=5000)

    start_date: datetime | None = None
    finish_date: datetime | None = None

    appointment_at: datetime | None = None
    travel_time: int | None = None

    duration: int | None = Field(default=None, ge=1)
    importance: int | None = Field(default=None, ge=0, le=3)
    consequences: int | None = Field(default=None, ge=0, le=3)
    progress: int | None = Field(default=None, ge=0, le=100)

    delay_to: datetime | None = None
    refusal_count: int | None = Field(default=None, ge=0)

    status_id: int | None = None
    sphere_id: UUID | None = None
    goal_id: UUID | None = None
