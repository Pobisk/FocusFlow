"""Вспомогательные функции для работы с проектами."""

from datetime import datetime, timedelta
from models.project import Project, ProjectStatus


def calc_speed(project: Project, now: datetime) -> float | None:
    """Вычисляет скорость проекта.

    Формула: progress / time_passed_percent
    - time_passed_percent: сколько % времени проекта прошло (0-100)
    - Если прошло < 1% — возвращаем None
    - Если progress = 0 и время прошло — возвращаем 0.0
    """
    if project.status_id != ProjectStatus.ACTIVE.value:
        return None

    start_ts = project.start_date.timestamp()
    # finish_date + 1 день — "дата ПО"
    finish_ts = (project.finish_date + timedelta(days=1)).timestamp()
    now_ts = now.timestamp()

    # Ограничиваем now границами интервала
    if now_ts < start_ts:
        return None
    if now_ts > finish_ts:
        now_ts = finish_ts

    total_span = finish_ts - start_ts
    if total_span <= 0:
        return None

    time_passed = now_ts - start_ts
    time_passed_percent = (time_passed / total_span) * 100

    if time_passed_percent < 1:
        return None

    speed = project.progress / time_passed_percent
    return round(speed, 1)
