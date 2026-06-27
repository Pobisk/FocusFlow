"""Pydantic schemas for UserSettings module."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class UserSettingsRead(BaseModel):
    """Схема для чтения настроек пользователя."""

    id: UUID
    user_id: UUID
    w_proactive: float
    w_importance: float
    w_consequences: float
    w_urgency: float
    w_refusals: float
    w_project_speed: float
    w_sphere_satisfaction: float
    delay_minutes: int
    deadline_near: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    """Схема для обновления настроек пользователя.

    Все поля опциональны — обновляются только переданные.
    """

    w_proactive: float | None = None
    w_importance: float | None = None
    w_consequences: float | None = None
    w_urgency: float | None = None
    w_refusals: float | None = None
    w_project_speed: float | None = None
    w_sphere_satisfaction: float | None = None
    delay_minutes: int | None = Field(default=None, ge=1)
    deadline_near: int | None = Field(default=None, ge=1)
