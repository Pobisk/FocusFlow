"""Pydantic схемы для экрана «Работа»."""

from pydantic import BaseModel, Field
from schemas.today import TodayTaskRead


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
