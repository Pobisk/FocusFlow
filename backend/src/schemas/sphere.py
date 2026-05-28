"""Pydantic schemas for Sphere module."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class SphereRead(BaseModel):
    """Схема для чтения сферы жизни."""

    id: UUID
    code: str
    name: str
    order: int
    is_active: bool
    satisfaction: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SphereCreate(BaseModel):
    """Схема для создания сферы жизни."""

    code: str = Field(
        ...,
        max_length=10,
        description="Однобуквенный или короткий код, например 'Ф', 'Р', 'Б'",
    )
    name: str = Field(..., max_length=200)
    order: int = Field(default=0)
    satisfaction: float = Field(default=3.0, ge=1.0, le=5.0)


class SphereUpdate(BaseModel):
    """Схема для обновления сферы жизни."""

    code: str | None = Field(default=None, max_length=10)
    name: str | None = Field(default=None, max_length=200)
    order: int | None = None
    is_active: bool | None = None
    satisfaction: float | None = Field(default=None, ge=1.0, le=5.0)


class SphereSatisfactionHistoryRead(BaseModel):
    """Схема для чтения записи истории удовлетворённости."""

    id: UUID
    sphere_id: UUID
    satisfaction: float
    changed_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
