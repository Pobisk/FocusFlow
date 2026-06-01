# backend/src/models/base.py
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import Integer, String
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
        default_factory=uuid7,
        primary_key=True,
        index=True,
        nullable=False,
    )

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        index=True,
        nullable=False,
        sa_type=UTCDateTime,
    )

    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        sa_type=UTCDateTime,
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )

    class Config:
        from_attributes = True
        json_encoders = {
            UUID: lambda v: str(v),
            datetime: lambda v: v.isoformat() if v else None,
        }


class UserOwnedModel(BaseModel):
    """Базовая модель для сущностей, принадлежащих пользователю."""

    user_id: UUID = Field(
        foreign_key="users.id",
        ondelete="CASCADE",
        nullable=False,
        index=True,
    )


class ReferenceModel(SQLModel):
    """Базовая модель для справочников (статусы, типы).

    Без created_at/updated_at, без автоинкремента.
    id задаётся вручную (1, 2, 3...).
    Содержит стандартные поля: id, code, name, sort_order, color.
    """

    __abstract__ = True

    id: int = Field(
        sa_column=Column(Integer, primary_key=True, autoincrement=False),
        description="ID элемента справочника (задаётся вручную)",
    )
    code: str = Field(
        max_length=20,
        nullable=False,
        unique=True,
        index=True,
        description="Машинное имя элемента справочника",
    )
    name: str = Field(
        max_length=100,
        nullable=False,
        description="Человекочитаемое название",
    )
    sort_order: int = Field(
        default=0,
        nullable=False,
        description="Порядок сортировки",
    )
    color: str | None = Field(
        default=None,
        max_length=7,
        description="HEX-цвет для UI (#22c55e, #3b82f6, #ef4444)",
    )

    class Config:
        from_attributes = True
