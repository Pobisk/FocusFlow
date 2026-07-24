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

router = APIRouter(prefix="/work-debug", tags=["work-debug"])


@router.get("", response_model=list[TaskScore])
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

    # ── Все активные задачи на сегодня по фокусным сферам (без встреч) ──
    stmt = (
        select(Task)
        .join(Sphere, Task.sphere_id == Sphere.id)
        .where(
            Task.user_id == user_id,
            Task.status_id == TaskStatus.ACTIVE.value,
            Task.finish_date >= local_date,
            Task.start_date <= local_date,
            Task.is_appointment == False,
            Sphere.is_focused == True,
        )
    )
    result = await db.execute(stmt)
    candidates = result.scalars().all()

    # ── Кеши ──────────────────────────────────────────
    project_cache: dict[UUID, tuple[str | None, float | None]] = {}
    sphere_cache: dict[UUID, str | None] = {}
    sphere_sat_cache: dict[UUID, float | None] = {}

    scores: list[TaskScore] = []
    for task in candidates:
        # Сфера
        sphere_code: str = ""
        if task.sphere_id not in sphere_cache:
            sphere_res = await db.execute(
                select(Sphere).where(Sphere.id == task.sphere_id)
            )
            sphere = sphere_res.scalar_one_or_none()
            sphere_cache[task.sphere_id] = sphere.code if sphere else ""
            sphere_sat_cache[task.sphere_id] = sphere.satisfaction if sphere else None
        sphere_code = sphere_cache[task.sphere_id] or ""
        sphere_satisfaction = sphere_sat_cache[task.sphere_id]

        # Проект
        project_title: str | None = None
        project_speed: float | None = None
        if task.project_id:
            if task.project_id not in project_cache:
                proj_res = await db.execute(
                    select(Project).where(Project.id == task.project_id)
                )
                proj = proj_res.scalar_one_or_none()
                project_cache[task.project_id] = (
                    proj.title if proj else None,
                    calc_speed(proj, current_moment) if proj else None,
                )
            proj_cache = project_cache[task.project_id]
            project_title = proj_cache[0]
            project_speed = proj_cache[1]

        score_obj = compute_score(task, settings, project_speed, sphere_satisfaction)
        # Обогащаем дополнительными полями
        score_obj.sphere_code = sphere_code
        score_obj.project_title = project_title
        score_obj.start_date = task.start_date
        score_obj.finish_date = task.finish_date
        scores.append(score_obj)

    scores.sort(key=lambda x: x.total, reverse=True)
    return scores
