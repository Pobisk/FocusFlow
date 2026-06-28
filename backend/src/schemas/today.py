"""Pydantic схемы для экрана «Сегодня»."""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class TodayTaskRead(BaseModel):
    """Задача на сегодня — обогащённая данными для отображения."""

    # ── Привязки ──────────────────────────────────
    id: UUID
    sphere_id: UUID
    sphere_code: str
    sphere_name: str
    project_id: UUID | None
    project_title: str | None
    goal_id: UUID | None
    goal_title: str | None

    # ── Основные поля ─────────────────────────────
    title: str
    is_appointment: bool

    # ── Даты ──────────────────────────────────────
    start_date: datetime
    finish_date: datetime
    appointment_at: datetime | None
    travel_time: int | None

    # ── Планирование ──────────────────────────────
    duration: int  # плановое время в минутах

    # ── Прогресс и откладывания ───────────────────
    progress: int
    refusal_count: int  # количество лягушек

    # ── Статус ────────────────────────────────────
    status_id: int
    status_code: str
    status_name: str
    status_color: str | None

    # ── Фактическое время на сегодня ──────────────
    actual_minutes: int = Field(
        default=0,
        description="Фактическое время на сегодня из TaskLog (одна запись на задачу+дату), в минутах",
    )

    # ── Кирпичик для экрана «Сегодня» ────────────
    brick_code: str = Field(
        description="Код кирпичика для отображения: "
                    "'completed' — зелёный (завершён), "
                    "'overdue' — красный (просрочка), "
                    "'near_deadline' — жёлтый (дедлайн близко), "
                    "'active' — без кирпичика (прочие активные), "
                    "'cancelled' — синий (отменён)",
    )

    # ── Служебные ─────────────────────────────────
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TodaySummary(BaseModel):
    """Сводка по дню."""
    planned_minutes: int = Field(
        default=480,  # 8 часов = 480 минут
        description="Плановое время в минутах (константа 8ч)",
    )
    actual_minutes: int = Field(
        default=0,
        description="Сумма фактического времени по всем задачам на сегодня",
    )
    goal_minutes: int = Field(
        default=0,
        description="Сумма фактического времени по задачам, привязанным к целям (целевое время)",
    )


class TodayResponse(BaseModel):
    """Ответ эндпоинта /api/today."""

    date: str = Field(
        description="Дата, на которую запрошен экран (YYYY-MM-DD, UTC)",
    )
    summary: TodaySummary
    tasks: list[TodayTaskRead]

