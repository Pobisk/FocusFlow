"""Pydantic схемы для КНМБ."""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class SomedayMaybeRead(BaseModel):
    """Одна запись КНМБ."""

    id: UUID
    sphere_id: UUID
    sphere_code: str = ""
    title: str
    description: str | None
    is_active: bool
    days_exist: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SomedayMaybeCreate(BaseModel):
    """Создание записи КНМБ."""

    sphere_id: UUID
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    is_active: bool = Field(default=True)


class SomedayMaybeUpdate(BaseModel):
    """Обновление записи КНМБ."""

    sphere_id: UUID
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    is_active: bool = Field(default=True)
