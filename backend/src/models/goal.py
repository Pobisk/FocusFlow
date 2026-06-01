"""Goal model — желаемый результат в сфере жизни к указанному сроку."""

import enum
from sqlmodel import Field, Index
from sqlalchemy import String
from models.base import UserOwnedModel, UTCDateTime
from uuid import UUID
from datetime import datetime


class GoalStatus(str, enum.Enum):
    """Статус цели."""
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Goal(UserOwnedModel, table=True):
    """Цель пользователя в определённой сфере жизни.

    Цели делят проекты/задачи на проактивные (ведут к цели)
    и реактивные (текущие дела без привязки к цели).
    """

    __tablename__ = "goals"

    # 🔗 Сфера жизни
    sphere_id: UUID = Field(
        foreign_key="spheres.id",
        nullable=False,
        index=True,
        description="Сфера жизни, к которой относится цель",
    )

    # 📝 Название цели
    title: str = Field(
        max_length=300,
        nullable=False,
        description="Название цели",
    )

    # 📄 Описание цели
    description: str | None = Field(
        default=None,
        max_length=2000,
        description="Описание цели (опционально)",
    )

    # 📅 Срок достижения
    deadline: datetime | None = Field(
        default=None,
        sa_type=UTCDateTime,  # ← TIMESTAMPTZ
        description="Срок достижения цели (TIMESTAMPTZ, UTC, опционально)",
    )

    # 📊 Статус (хранится как строка, не ENUM)
    status: GoalStatus = Field(
        nullable=False,
        default=GoalStatus.ACTIVE,
        sa_type=String(20),
        description="Статус цели: active, completed, cancelled",
    )

    __table_args__ = (
        Index("ix_goals_user_sphere", "user_id", "sphere_id"),
    )
