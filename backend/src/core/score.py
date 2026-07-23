"""Вычисление Score для задачи — алгоритм выбора задачи для экрана «Работа»."""

from datetime import datetime, timezone, timedelta
from models.task import Task
from models.user_settings import UserSettings
from schemas.work import TaskScore


def _calc_urgency(period_seconds: float, elapsed_seconds: float) -> float:
    """Вычисляет срочность (urgency_raw) по табличной функции с линейной аппроксимацией.

    Таблица: [pos, value]
      pos=0.0   → 0.0
      pos=0.333 → 0.5
      pos=0.666 → 0.85
      pos=1.0   → 1.0
    """
    if period_seconds <= 0:
        return 0.0

    pos = max(0.0, min(1.0, elapsed_seconds / period_seconds))

    TABLE: list[tuple[float, float]] = [
        (0.0, 0.0),
        (1 / 3, 0.5),
        (2 / 3, 0.85),
        (1.0, 1.0),
    ]

    # Поиск интервала
    for i in range(len(TABLE) - 1):
        x0, y0 = TABLE[i]
        x1, y1 = TABLE[i + 1]
        if x0 <= pos <= x1:
            # Линейная аппроксимация
            return y0 + (y1 - y0) * (pos - x0) / (x1 - x0)

    # Если pos на границе — крайние значения
    return TABLE[-1][1]


def compute_score(
    task: Task,
    settings: UserSettings,
    project_speed: float | None,
    sphere_satisfaction: float | None,
) -> TaskScore:
    """Вычисляет Score для задачи.

    Чем выше Score — тем более приоритетна задача.

    Args:
        task: Задача.
        settings: Настройки пользователя (весовые коэффициенты).
        project_speed: Скорость проекта (число >=0, норма 0.9+, иначе плохо).
        sphere_satisfaction: Удовлетворённость сферы (0-5, float).

    Returns:
        TaskScore — детализированный результат с сырыми характеристиками и итогом.
    """
    now = datetime.now(timezone.utc)

    # 1) Проактивность (привязка к цели)
    # нет цели → 0, есть цель → 1 (нормировано от 0 до 1)
    proactive_raw = 1.0 if task.goal_id else 0.0

    # 2) Важность (0-3) → нормируем до 0-1
    importance_raw = float(task.importance) / 3.0

    # 3) Последствия (0-3) → нормируем до 0-1
    consequences_raw = float(task.consequences) / 3.0

    # 4) Срочность — время до дедлайна (уже нормировано 0-1 из _calc_urgency)
    period_seconds = (task.finish_date + timedelta(days=1) - task.start_date).total_seconds()
    elapsed_seconds = (now - task.start_date).total_seconds()
    urgency_raw = _calc_urgency(period_seconds, elapsed_seconds)

    # 5) Количество откладываний (лягушки)
    refusals_raw = min(task.refusal_count / 30, 1.0)

    # 6) Скорость проекта
    if project_speed is not None and project_speed < 0.9:
        project_penalty_raw = (0.9 - project_speed) / 0.9
    else:
        project_penalty_raw = 0.0

    # 7) Удовлетворённость в сфере (0-5, float)
    if sphere_satisfaction is not None and sphere_satisfaction < 4:
        sphere_penalty_raw = (5 - sphere_satisfaction) / 5
    else:
        sphere_penalty_raw = 0.0

    # Итоговый score = sum(weight * raw)
    total = (
        settings.w_proactive * proactive_raw
        + settings.w_importance * importance_raw
        + settings.w_consequences * consequences_raw
        + settings.w_urgency * urgency_raw
        + settings.w_refusals * refusals_raw
        + settings.w_project_speed * project_penalty_raw
        + settings.w_sphere_satisfaction * sphere_penalty_raw
    )

    return TaskScore(
        id=task.id,
        title=task.title,
        sphere_code="",
        project_title=None,
        start_date=task.start_date,
        finish_date=task.finish_date,
        proactive=proactive_raw,
        w_proactive=settings.w_proactive,
        importance=importance_raw,
        w_importance=settings.w_importance,
        consequences=consequences_raw,
        w_consequences=settings.w_consequences,
        urgency=urgency_raw,
        w_urgency=settings.w_urgency,
        refusals=refusals_raw,
        w_refusals=settings.w_refusals,
        project_speed_penalty=project_penalty_raw,
        w_project_speed=settings.w_project_speed,
        sphere_satisfaction_penalty=sphere_penalty_raw,
        w_sphere_satisfaction=settings.w_sphere_satisfaction,
        total=total,
    )
