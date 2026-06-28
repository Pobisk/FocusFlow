"""Вычисление Score для задачи — алгоритм выбора задачи для экрана «Работа»."""

from datetime import datetime, timezone
from models.task import Task
from models.user_settings import UserSettings


def compute_score(
    task: Task,
    settings: UserSettings,
    project_speed: float | None,
    sphere_satisfaction: float | None,
) -> float:
    """Вычисляет Score для задачи.

    Чем выше Score — тем более приоритетна задача.

    Args:
        task: Задача.
        settings: Настройки пользователя (весовые коэффициенты).
        project_speed: Скорость проекта (число >=0, норма 0.9+, иначе плохо).
        sphere_satisfaction: Удовлетворённость сферы (0-5, float).

    Returns:
        Числовая оценка приоритета задачи.
    """
    now = datetime.now(timezone.utc)
    score = 0.0

    # 1) Проактивность (привязка к цели) — *3
    if task.goal_id:
        score += settings.w_proactive * 3

    # 2) Важность (0-3)
    score += settings.w_importance * task.importance

    # 3) Последствия (0-3)
    score += settings.w_consequences * task.consequences

    # 4) Срочность — время до дедлайна
    period_minutes = (task.finish_date - task.start_date).total_seconds() / 60
    if period_minutes > 0:
        minutes_since_start = (now - task.start_date).total_seconds() / 60
        pos = max(0, min(1, minutes_since_start / period_minutes))
        if pos < 1 / 3:
            urgency = pos * 3
        elif pos < 2 / 3:
            urgency = 0.3 * (pos - 1 / 3) * 3
        else:
            urgency = 2.0 * (pos - 2 / 3) * 3
        score += settings.w_urgency * urgency

    # 5) Количество откладываний (лягушки)
    # Нормируем от 0 до 1: >= 100 откладываний = 1
    frogs = min(task.refusal_count / 100, 1.0)
    score += settings.w_refusals * frogs

    # 6) Скорость проекта
    # Норма — 0.9 и выше. Если < 0.9 — тем выше score, чем меньше скорость
    if project_speed is not None and project_speed < 0.9:
        score += settings.w_project_speed * (0.9 - project_speed) / 0.9

    # 7) Удовлетворённость в сфере (0-5, float)
    # Чем ниже удовлетворённость (< 4 из 5) — тем выше score
    if sphere_satisfaction is not None and sphere_satisfaction < 4:
        score += settings.w_sphere_satisfaction * (5 - sphere_satisfaction) / 5

    return score
