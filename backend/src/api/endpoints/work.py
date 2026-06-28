"""Work endpoint — алгоритм выбора задачи для экрана «Работа»."""

from fastapi import APIRouter, Depends, Query
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timedelta, timezone

from db.session import get_db
from models.task import Task, TaskStatus, TaskStatusRef
from models.task_log import TaskLog
from models.sphere import Sphere
from models.project import Project
from models.goal import Goal
from models.user_settings import UserSettings
from core.score import compute_score
from schemas.work import WorkResponse
from schemas.today import TodayTaskRead
from core.auth import get_current_user_id

router = APIRouter(prefix="/work", tags=["work"])


async def _enrich_task(
    db: AsyncSession,
    task: Task,
    actual_minutes: int = 0,
) -> TodayTaskRead:
    """Обогащает задачу данными для отображения."""
    sphere_res = await db.execute(select(Sphere).where(Sphere.id == task.sphere_id))
    sphere = sphere_res.scalar_one_or_none()

    project_title = None
    if task.project_id:
        proj_res = await db.execute(select(Project).where(Project.id == task.project_id))
        proj = proj_res.scalar_one_or_none()
        if proj:
            project_title = proj.title

    goal_title = None
    if task.goal_id:
        goal_res = await db.execute(select(Goal).where(Goal.id == task.goal_id))
        goal = goal_res.scalar_one_or_none()
        if goal:
            goal_title = goal.title

    status_res = await db.execute(
        select(TaskStatusRef).where(TaskStatusRef.id == task.status_id)
    )
    status_ref = status_res.scalar_one_or_none() or TaskStatusRef(
        id=task.status_id, code="unknown", name="Неизвестный", sort_order=99
    )

    return TodayTaskRead(
        id=task.id,
        sphere_id=task.sphere_id,
        sphere_code=sphere.code if sphere else "",
        sphere_name=sphere.name if sphere else "",
        project_id=task.project_id,
        project_title=project_title,
        goal_id=task.goal_id,
        goal_title=goal_title,
        title=task.title,
        description=task.description,
        is_appointment=task.is_appointment,
        start_date=task.start_date,
        finish_date=task.finish_date,
        appointment_at=task.appointment_at,
        travel_time=task.travel_time,
        duration=task.duration,
        progress=task.progress,
        refusal_count=task.refusal_count,
        status_id=task.status_id,
        status_code=status_ref.code,
        status_name=status_ref.name,
        status_color=status_ref.color,
        actual_minutes=actual_minutes,
        brick_code="active",
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.get("", response_model=WorkResponse)
async def get_work(
    local_date: datetime = Query(
        ...,
        description="Сегодняшняя дата (UTC ISO 8601). "
                    "Фронт конвертирует 00:00 локального времени в UTC и передаёт сюда.",
    ),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WorkResponse:
    """
    Алгоритм выбора задачи для экрана «Работа».

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Возвращает одну задачу, рекомендованную к выполнению.
    """
    current_moment = datetime.now(timezone.utc)

    # Загружаем настройки
    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = settings_result.scalar_one_or_none()
    if not settings:
        return WorkResponse(task=None, total_tasks=0)

    # ── 1. Все активные задачи на сегодня ─────────────
    stmt = select(Task).where(
        Task.user_id == user_id,
        Task.status_id == TaskStatus.ACTIVE.value,
        Task.finish_date >= local_date,
        Task.start_date <= local_date,
    )
    result = await db.execute(stmt)
    all_tasks = result.scalars().all()

    if not all_tasks:
        return WorkResponse(task=None, total_tasks=0)

    total_tasks = len(all_tasks)

    # ── 2. Загружаем TaskLog на сегодня ────────────────
    task_ids = [t.id for t in all_tasks]
    log_result = await db.execute(
        select(TaskLog).where(
            TaskLog.task_id.in_(task_ids),
            TaskLog.user_id == user_id,
            TaskLog.log_date == local_date,
        )
    )
    log_map: dict[UUID, int] = {
        row.task_id: row.minutes
        for row in log_result.scalars().all()
    }

    # ── 3. Проверяем встречи ───────────────────────────
    appointments = [t for t in all_tasks if t.is_appointment]
    min_next_appointment_minutes: float = float("inf")

    for apt in appointments:
        if apt.appointment_at:
            real_start = apt.appointment_at - timedelta(minutes=apt.travel_time or 0)
            real_end = apt.appointment_at + timedelta(minutes=apt.duration)

            if real_start <= current_moment <= real_end:
                enriched = await _enrich_task(db, apt, log_map.get(apt.id, 0))
                return WorkResponse(task=enriched, total_tasks=total_tasks)

            if real_start > current_moment:
                minutes_to = (real_start - current_moment).total_seconds() / 60
                if minutes_to < min_next_appointment_minutes:
                    min_next_appointment_minutes = minutes_to

    # ── 4. Фильтруем ──────────────────────────────────
    candidates = [t for t in all_tasks if not t.is_appointment]

    # Убираем отложенные
    candidates = [
        t for t in candidates
        if not (t.delay_to and t.delay_to > current_moment)
    ]

    # Убираем задачи, которые не успеем до следующей встречи
    if min_next_appointment_minutes < float("inf"):
        candidates = [
            t for t in candidates
            if t.duration <= min_next_appointment_minutes
        ]

    if not candidates:
        return WorkResponse(task=None, total_tasks=total_tasks)

    # ── 5. Считаем Score ──────────────────────────────
    project_cache: dict[UUID, float | None] = {}
    sphere_cache: dict[UUID, float | None] = {}

    scored: list[tuple[float, Task]] = []
    for task in candidates:
        # Скорость проекта — заглушка (TODO: вычислить реальную скорость)
        project_speed: float | None = None
        if task.project_id:
            if task.project_id not in project_cache:
                proj_res = await db.execute(
                    select(Project).where(Project.id == task.project_id)
                )
                proj = proj_res.scalar_one_or_none()
                # Заглушка: 1.0 если проект существует
                project_cache[task.project_id] = 1.0 if proj else None
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

        score = compute_score(task, settings, project_speed, sphere_satisfaction)
        scored.append((score, task))

    scored.sort(key=lambda x: -x[0])
    best_score, best_task = scored[0]

    enriched = await _enrich_task(db, best_task, log_map.get(best_task.id, 0))
    return WorkResponse(task=enriched, total_tasks=total_tasks)
