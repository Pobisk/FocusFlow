"""Project model — контейнер для действий, привязанный к сфере жизни и опционально к цели."""

import enum
from sqlmodel import Field
from sqlalchemy import String
from models.base import UserOwnedModel, UTCDateTime
from uuid import UUID
from datetime import datetime


class ProjectStatus(str, enum.Enum):
    """Статус проекта."""
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    SOMEDAY = "someday"


class ProjectType(str, enum.Enum):
    """Тип проекта."""
    PROJECT = "project"  # проект с несколькими действиями
    TASK = "task"        # вырожденный проект в одно действие


class Project(UserOwnedModel, table=True):
    """Проект/задача пользователя в сфере жизни.

    Проект — это набор действий, ведущих к цели (или без неё).
    Задача (task) — вырожденный проект с одним действием.
    """

    __tablename__ = "projects"

    # 🔗 Сфера жизни
    sphere_id: UUID = Field(
        foreign_key="spheres.id",
        nullable=False,
        index=True,
        description="Сфера жизни",
    )

    # 🎯 Цель (опционально)
    goal_id: UUID | None = Field(
        foreign_key="goals.id",
        default=None,
        index=True,
        description="Цель, к которой относится проект",
    )

    # 📝 Название
    title: str = Field(
        max_length=300,
        nullable=False,
        description="Название проекта",
    )

    # 📄 Описание
    description: str | None = Field(
        default=None,
        max_length=5000,
        description="Описание проекта",
    )

    # 🏷 Тип (хранится как строка, не ENUM)
    project_type: ProjectType = Field(
        nullable=False,
        default=ProjectType.PROJECT,
        sa_type=String(20),
        description="Тип: project (несколько действий) или task (одно действие)",
    )

    # 📊 Статус (хранится как строка, не ENUM)
    status: ProjectStatus = Field(
        nullable=False,
        default=ProjectStatus.ACTIVE,
        sa_type=String(20),
        description="Статус проекта",
    )

    # 📅 Даты
    start_date: datetime | None = Field(
        default=None,
        sa_type=UTCDateTime,
        description="Дата начала (TIMESTAMPTZ, UTC)",
    )
    target_date: datetime | None = Field(
        default=None,
        sa_type=UTCDateTime,
        description="Целевая дата завершения (TIMESTAMPTZ, UTC)",
    )

    # 📈 Прогресс
    progress: int = Field(
        nullable=False,
        default=0,
        ge=0,
        le=100,
        description="Прогресс 0-100",
    )
