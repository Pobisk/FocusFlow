"""Task model — задачи пользователя."""

import enum
from datetime import datetime
from uuid import UUID
from sqlmodel import Field, Column, Integer
from sqlalchemy import String as SAString

from models.base import UserOwnedModel, BaseModel, UTCDateTime


# ── Справочник статусов задачи ────────────────────────


class TaskStatus(int, enum.Enum):
    """Статусы задачи, соответствуют id в справочной таблице."""

    ACTIVE = 1
    COMPLETED = 2
    CANCELLED = 3


class TaskStatusRef(BaseModel, table=True):
    """Справочник статусов задачи.

    Заполняется через seed-миграцию.
    """

    __tablename__ = "task_statuses"

    id: int = Field(sa_column=Column(Integer, primary_key=True, autoincrement=False))
    code: str = Field(max_length=20, unique=True, index=True)
    name: str = Field(max_length=100)
    sort_order: int = Field(default=0)
    color: str | None = Field(default=None, max_length=7)


# ── Модель задачи ─────────────────────────────────────


class Task(UserOwnedModel, table=True):
    """Задача пользователя.

    Главный рабочий элемент системы. Может быть:
    - отдельной (project_id = None, sphere_id обязателен)
    - проектной (project_id задан, sphere_id и goal_id копируются из проекта)
    - встречей (is_appointment = True, appointment_at задан)
    """

    __tablename__ = "tasks"

    # ── Привязки ──────────────────────────────────
    sphere_id: UUID = Field(
        foreign_key="spheres.id",
        nullable=False,
        index=True,
        description="Сфера жизни (всегда обязательна)",
    )
    project_id: UUID | None = Field(
        default=None,
        foreign_key="projects.id",
        index=True,
        description="Проект (если проектная задача)",
    )
    goal_id: UUID | None = Field(
        default=None,
        foreign_key="goals.id",
        index=True,
        description="Цель (опционально, для проектных копируется из проекта)",
    )

    # ── Основные поля ─────────────────────────────
    title: str = Field(
        nullable=False,
        max_length=500,
        index=True,
        description="Название задачи",
    )
    description: str | None = Field(
        default=None,
        max_length=5000,
        description="Описание задачи",
    )

    # ── Тип задачи ────────────────────────────────
    is_appointment: bool = Field(
        default=False,
        nullable=False,
        description="Признак встречи (можно менять только при создании)",
    )

    # ── Даты (UTC, 00:00 локального времени) ──────
    start_date: datetime = Field(
        nullable=False,
        sa_type=UTCDateTime,
        description="Дата старта (UTC, 00:00 локального времени)",
    )
    finish_date: datetime = Field(
        nullable=False,
        sa_type=UTCDateTime,
        description="Дата финиша (UTC, 00:00 локального времени). Для встреч = start_date",
    )

    # ── Встреча ───────────────────────────────────
    appointment_at: datetime | None = Field(
        default=None,
        sa_type=UTCDateTime,
        description="Точные дата и время встречи (TIMESTAMPTZ, UTC)",
    )
    travel_time: int | None = Field(
        default=None,
        description="Время на дорогу в минутах (для встреч)",
    )

    # ── Плановая длительность ─────────────────────
    duration: int = Field(
        default=30,
        nullable=False,
        description="Плановая длительность в минутах",
    )

    # ── Приоритеты ────────────────────────────────
    importance: int = Field(
        default=0,
        nullable=False,
        description="Приоритет «важность» (0-3)",
    )
    consequences: int = Field(
        default=0,
        nullable=False,
        description="Приоритет «последствия» (0-3)",
    )

    # ── Прогресс ──────────────────────────────────
    progress: int = Field(
        default=0,
        nullable=False,
        description="Прогресс (0-100)",
    )

    # ── Откладывание ──────────────────────────────
    delay_to: datetime | None = Field(
        default=None,
        sa_type=UTCDateTime,
        description="Отложено до (дата-время, UTC)",
    )
    refusal_count: int = Field(
        default=0,
        nullable=False,
        description="Количество откладываний (число лягушек)",
    )

    # ── Статус ────────────────────────────────────
    status_id: int = Field(
        default=TaskStatus.ACTIVE.value,
        foreign_key="task_statuses.id",
        nullable=False,
        index=True,
        description="Статус задачи (FK → task_statuses)",
    )
