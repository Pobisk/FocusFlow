# backend/src/models/base.py
from sqlmodel import Field, SQLModel
from uuid import UUID
from datetime import datetime, timezone
from uuid6 import uuid7
from sqlalchemy import DateTime


class UTCDateTime(DateTime):
    """DateTime с timezone=True по умолчанию.
    
    Всегда хранит TIMESTAMPTZ в PostgreSQL.
    """
    def __init__(self, **kwargs: bool) -> None:
        super().__init__(timezone=True, **kwargs)


class BaseModel(SQLModel):
    """Базовая модель для всех сущностей с UUID v7"""

    id: UUID = Field(
        default_factory=uuid7,      # ← UUID v7 вместо uuid4
        primary_key=True,
        index=True,                 # Индекс по PK (важно для JOIN)
        nullable=False,
    )

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),  # ← timezone-aware
        index=True,                 # Отдельный индекс для сортировки по времени
        nullable=False,
        sa_type=UTCDateTime,        # ← TIMESTAMPTZ
    )

    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        sa_type=UTCDateTime,        # ← TIMESTAMPTZ
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )

    class Config:
        """SQLModel config"""
        from_attributes = True
        # ✅ UUID будет сериализоваться как строка в JSON
        json_encoders = {
            UUID: lambda v: str(v),
            datetime: lambda v: v.isoformat() if v else None,
        }


class UserOwnedModel(BaseModel):
    """Базовая модель для сущностей, принадлежащих пользователю.

    Добавляет поле user_id для прямой фильтрации без JOIN.
    Все модели данных пользователя должны наследоваться от этого класса.
    """

    user_id: UUID = Field(
        foreign_key="users.id",
        ondelete="CASCADE",
        nullable=False,
        index=True,
    )
