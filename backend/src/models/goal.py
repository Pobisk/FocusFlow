"""Goal model — желаемый результат в сфере жизни к указанному сроку."""

import enum
from sqlmodel import Field, Index, Column
from sqlalchemy import Integer
from models.base import UserOwnedModel, ReferenceModel, UTCDateTime
from uuid import UUID
from datetime import datetime


class GoalStatus(int, enum.Enum):
    """Числовой enum статусов цели. Значения соответствуют ID в goal_statuses."""
    ACTIVE = 1
    COMPLETED = 2
    CANCELLED = 3


class GoalStatusRef(ReferenceModel, table=True):
    """Справочник статусов цели.

    Наследует от ReferenceModel: code, name, sort_order, color.
    id задаётся вручную (1, 2, 3...).
    Заполняется через seed в миграции.
    """

    __tablename__ = "goal_statuses"

    id: int = Field(
        sa_column=Column(Integer, primary_key=True, autoincrement=False),
        description="ID статуса (задаётся вручную)",
    )


class Goal(UserOwnedModel, table=True):
    """Цель пользователя в определённой сфере жизни.

    Статус хранится как status_id (Integer FK → goal_statuses.id).
    В коде используется Python-Enum с int-значениями для type safety.
    """

    __tablename__ = "goals"
    sphere_id: UUID = Field(
        foreign_key="spheres.id",
        nullable=False,
        index=True,
        description="Сфера жизни, к которой относится цель",
    )
    title: str = Field(
        max_length=300,
        nullable=False,
        description="Название цели",
    )
    description: str | None = Field(
        default=None,
        max_length=2000,
        description="Описание цели (опционально)",
    )
    deadline: datetime | None = Field(
        default=None,
        sa_type=UTCDateTime,
        description="Срок достижения цели (TIMESTAMPTZ, UTC, опционально)",
    )
    status_id: int = Field(
        default=GoalStatus.ACTIVE.value,
        foreign_key="goal_statuses.id",
        nullable=False,
        index=True,
        description="ID статуса цели: 1-активна, 2-завершена, 3-отменена",
    )

    __table_args__ = (
        Index("ix_goals_user_sphere", "user_id", "sphere_id"),
    )

