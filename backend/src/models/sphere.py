"""Sphere model for life areas reference."""
from sqlmodel import Field, Index
from models.base import UserOwnedModel, UTCDateTime
from uuid import UUID
from datetime import datetime


class Sphere(UserOwnedModel, table=True):
    """Сущность сферы жизни для персональной настройки пользователя."""

    __tablename__ = "spheres"

    # 🏷️ Код сферы (например: "Ф", "Р", "Б", "С", "Ло", "Фх", "М", "Мч", "Кв", "Квс")
    code: str = Field(
        max_length=10,
        nullable=False,
        description="Краткий код сферы жизни",
    )

    # 📝 Наименование сферы
    name: str = Field(
        max_length=200,
        nullable=False,
        description="Полное наименование сферы",
    )

    # 🔢 Порядок сортировки
    order: int = Field(
        nullable=False,
        default=0,
        description="Порядок отображения сферы в списке",
    )

    # ✅ Признак активности
    is_active: bool = Field(
        default=True,
        nullable=False,
        description="Признак активности сферы",
    )

    # ⭐ Оценка удовлетворённости (1.0 - 5.0)
    satisfaction: float = Field(
        nullable=False,
        default=3.0,
        ge=1.0,
        le=5.0,
        description="Оценка удовлетворённости сферой от 1.0 до 5.0",
    )

    # 🎯 Признак фокуса (для фокусировки на сфере)
    is_focused: bool = Field(
        default=True,
        nullable=False,
        description="Признак фокуса на сфере",
    )

    __table_args__ = (
        Index("ix_spheres_user_id_code", "user_id", "code", unique=True),
    )


class SphereSatisfactionHistory(UserOwnedModel, table=True):
    """История изменения оценки удовлетворённости сферы."""

    __tablename__ = "sphere_satisfaction_history"

    # 🔗 Foreign Key to Sphere
    sphere_id: UUID = Field(
        foreign_key="spheres.id",
        ondelete="CASCADE",
        nullable=False,
        index=True,
    )

    # ⭐ Значение удовлетворённости на момент записи
    satisfaction: float = Field(
        nullable=False,
        description="Значение удовлетворённости на момент записи",
    )

    # 📅 Дата и время изменения
    changed_at: datetime = Field(
        nullable=False,
        sa_type=UTCDateTime,  # ← TIMESTAMPTZ
        description="Дата и время изменения",
    )
