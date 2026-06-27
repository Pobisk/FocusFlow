"""Project model — набор задач для достижения результата.

Project может быть проактивным (привязан к цели) или реактивным (без цели).
Всегда привязан к сфере жизни.
Статус хранится как Integer FK → project_statuses (справочная таблица).
"""

import enum
from sqlmodel import Field, Index, Column
from sqlalchemy import Integer
from models.base import UserOwnedModel, ReferenceModel, UTCDateTime
from uuid import UUID
from datetime import datetime


class ProjectStatus(int, enum.Enum):
    """Числовой enum статусов проекта. Значения соответствуют ID в project_statuses."""
    ACTIVE = 1
    COMPLETED = 2
    CANCELLED = 3


class ProjectStatusRef(ReferenceModel, table=True):
    """Справочник статусов проекта.

    Наследует от ReferenceModel: code, name, sort_order, color.
    id задаётся вручную (1, 2, 3...).
    Заполняется через seed в миграции.
    """

    __tablename__ = "project_statuses"

    id: int = Field(
        sa_column=Column(Integer, primary_key=True, autoincrement=False),
        description="ID статуса (задаётся вручную)",
    )


class Project(UserOwnedModel, table=True):
    """Проект пользователя — набор задач для достижения результата.

    Project всегда привязан к сфере (sphere_id).
    Опционально привязан к цели (goal_id) — тогда это проактивный проект.
    Статус хранится как status_id (Integer FK → project_statuses.id).
    """

    __tablename__ = "projects"

    # ── Привязки ────────────────────────────────────
    sphere_id: UUID = Field(
        foreign_key="spheres.id",
        nullable=False,
        index=True,
        description="Сфера жизни, к которой относится проект",
    )
    goal_id: UUID | None = Field(
        default=None,
        foreign_key="goals.id",
        nullable=True,
        index=True,
        description="Цель (опционально). Если задана — проект проактивный",
    )

    # ── Основные поля ───────────────────────────────
    title: str = Field(
        max_length=300,
        nullable=False,
        description="Название проекта",
    )
    description: str | None = Field(
        default=None,
        max_length=5000,
        description="Описание проекта (опционально)",
    )

    # ── Даты ────────────────────────────────────────
    start_date: datetime = Field(
        nullable=False,
        sa_type=UTCDateTime,
        description="Дата старта проекта (UTC, время = 00:00 локального времени)",
    )
    finish_date: datetime = Field(
        nullable=False,
        sa_type=UTCDateTime,
        description="Дата финиша проекта, 'дата ПО' (UTC, время = 00:00 локального времени)",
    )

    # ── Статус и прогресс ────────────────────────────
    status_id: int = Field(
        default=ProjectStatus.ACTIVE.value,
        foreign_key="project_statuses.id",
        nullable=False,
        index=True,
        description="ID статуса проекта: 1-активен, 2-завершён, 3-отменён",
    )
    progress: int = Field(
        default=0,
        nullable=False,
        ge=0,
        le=100,
        description="Прогресс выполнения проекта (0-100%)",
    )

    __table_args__ = (
        Index("ix_projects_user_sphere", "user_id", "sphere_id"),
        Index("ix_projects_user_goal", "user_id", "goal_id"),
    )

