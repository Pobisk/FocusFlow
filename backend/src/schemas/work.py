"""Pydantic схемы для экрана «Работа»."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from schemas.today import TodayTaskRead


class TaskScore(BaseModel):
    """Результат вычисления Score для задачи с разложением по компонентам."""

    id: UUID = Field(description="UUID задачи")
    title: str = Field(description="Название задачи")

    # ── Дополнительные поля для дебага ─────────────────
    sphere_code: str = Field(default="", description="Код сферы")
    project_title: str | None = Field(default=None, description="Название проекта")
    start_date: datetime = Field(description="Дата старта задачи")
    finish_date: datetime = Field(description="Дата финиша задачи")

    # 7 пар: характеристика + вес из настроек
    # 1) Проактивность
    proactive: float = Field(default=0.0, description="Проактивность: 2 если привязана к цели, иначе 0")
    w_proactive: float = Field(default=0.0, description="Вес проактивности из настроек")

    # 2) Важность
    importance: float = Field(default=0.0, description="Важность задачи (0-3)")
    w_importance: float = Field(default=0.0, description="Вес важности из настроек")

    # 3) Последствия
    consequences: float = Field(default=0.0, description="Последствия задачи (0-3)")
    w_consequences: float = Field(default=0.0, description="Вес последствий из настроек")

    # 4) Срочность
    urgency: float = Field(default=0.0, description="Срочность (нормированная позиция в интервале, 0-2)")
    w_urgency: float = Field(default=0.0, description="Вес срочности из настроек")

    # 5) Откладывания (лягушки)
    refusals: float = Field(default=0.0, description="Откладывания (нормировано 0-1)")
    w_refusals: float = Field(default=0.0, description="Вес откладываний из настроек")

    # 6) Скорость проекта
    project_speed_penalty: float = Field(default=0.0, description="Штраф за низкую скорость проекта: (0.9-speed)/0.9")
    w_project_speed: float = Field(default=0.0, description="Вес скорости проекта из настроек")

    # 7) Удовлетворённость сферы
    sphere_satisfaction_penalty: float = Field(default=0.0, description="Штраф за низкую удовлетворённость сферы: (5-sat)/5")
    w_sphere_satisfaction: float = Field(default=0.0, description="Вес удовлетворённости сферы из настроек")

    # Итоговый score
    total: float = Field(default=0.0, description="Итоговый Score задачи = sum(raw * weight)")


class WorkResponse(BaseModel):
    """Ответ эндпоинта /api/work.

    Возвращает выбранную алгоритмом задачу для работы.
    Если подходящих задач нет — task = None.
    """

    task: TodayTaskRead | None = Field(
        description="Выбранная алгоритмом задача. None если задач нет.",
    )
    total_tasks: int = Field(
        description="Общее количество активных задач на сегодня (до фильтрации)",
    )
    delay_minutes: int = Field(
        default=60,
        description="Значение delay_minutes из настроек (для кнопки «Позже»)",
    )


class WorkSelectResponse(BaseModel):
    """Ответ эндпоинта POST /api/work/select.

    Возвращает только task_id выбранной алгоритмом задачи.
    """

    task_id: UUID | None = Field(
        description="UUID выбранной задачи. None если подходящих задач нет.",
    )
