"""Work debug endpoint — отладка скоринга для экрана «Работа».

⚠️ Только для отладки. В production не используется.
Чтобы отключить — удалить include_router в main.py.
"""

from fastapi import APIRouter, Depends, Query
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timezone

from db.session import get_db
from models.task import Task, TaskStatus
from models.sphere import Sphere
from models.project import Project
from models.user_settings import UserSettings
from core.score import compute_score
from core.project import calc_speed
from schemas.work import TaskScore
from core.auth import get_current_user_id

router = APIRouter(prefix="/work", tags=["work-debug"])


@router.get("/debug", response_model=list[TaskScore])
async def get_work_debug(
    local_date: datetime = Query(
        ...,
        description="Сегодняшняя дата (UTC ISO 8601). "
                    "Фронт конвертирует 00:00 локального времени в UTC и передаёт сюда.",
    ),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[TaskScore]:
    """
    Отладка скоринга: показывает TaskScore для всех активных задач на сегодня.

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Возвращает массив TaskScore (без встреч), отсортированный по убыванию total.
    ⚠️ Только для отладки, не используется на фронте.
    """
    current_moment = datetime.now(timezone.utc)

    # Загружаем настройки
    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = settings_result.scalar_one_or_none()
    if not settings:
        return []

    # ── Все активные задачи на сегодня (без встреч) ──
    stmt = select(Task).where(
        Task.user_id == user_id,
        Task.status_id == TaskStatus.ACTIVE.value,
        Task.finish_date >= local_date,
        Task.start_date <= local_date,
        Task.is_appointment == False,
    )
    result = await db.execute(stmt)
    candidates = result.scalars().all()

    # ── Считаем Score для каждой ──────────────────────
    project_cache: dict[UUID, float | None] = {}
    sphere_cache: dict[UUID, float | None] = {}

    scores: list[TaskScore] = []
    for task in candidates:
        # Скорость проекта
        project_speed: float | None = None
        if task.project_id:
            if task.project_id not in project_cache:
                proj_res = await db.execute(
                    select(Project).where(Project.id == task.project_id)
                )
                proj = proj_res.scalar_one_or_none()
                project_cache[task.project_id] = calc_speed(proj, current_moment) if proj else None
            project_speed = project_cache[task.project_id]

        # Удовлетворённость сферы
        sphere_satisfaction: float | None = None
        if task.sphere_id not in sphere_cache:
            sphere_res = await db.execute(
                select(Sphere).where(Sphere.id == task.sphere_id)
            )
            sphere = sphere_res.scalar_one_or_none()
            sphere_cache[task.sphere_id] = sphere.satisfaction if sphere else None
        sphere_satisfaction = sphere_cache[task.sphere_id]

        score_obj = compute_score(task, settings, project_speed, sphere_satisfaction)
        scores.append(score_obj)

    scores.sort(key=lambda x: x.id)
    return scores
