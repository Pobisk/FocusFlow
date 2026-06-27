"""Pydantic схемы для TaskLog."""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class TaskLogRead(BaseModel):
    """Одна запись о трудозатратах."""

    id: UUID
    task_id: UUID
    log_date: datetime
    minutes: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskLogCreate(BaseModel):
    """Создание/обновление записи о трудозатратах.

    Если запись с (task_id, log_date) уже существует — будет обновлена.
    """

    log_date: datetime
    minutes: int = Field(..., ge=0, le=1440)
