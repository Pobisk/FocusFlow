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
from core.project import calc_speed
from schemas.work import WorkResponse, WorkSelectResponse, TaskScore
from schemas.today import TodayTaskRead
from core.auth import get_current_user_id

router = APIRouter(prefix="/work", tags=["work"])


async def _read_task_actual_minutes(
    task_id: UUID,
    user_id: UUID,
    local_date: datetime,
    db: AsyncSession,
) -> int:
    """Читает фактическое время (минут) для задачи на указанную дату.

    Если записи в TaskLog нет — возвращает 0.
    """
    result = await db.execute(
        select(TaskLog).where(
            TaskLog.task_id == task_id,
            TaskLog.user_id == user_id,
            TaskLog.log_date == local_date,
        )
    )
    log = result.scalar_one_or_none()
    return log.minutes if log else 0


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


async def _run_selection_algorithm(
    local_date: datetime,
    user_id: UUID,
    db: AsyncSession,
) -> tuple[Task | None, int]:
    """Алгоритм выбора задачи. Возвращает (выбранная задача, total_tasks).

    Если подходящих задач нет — (None, total_tasks).
    """
    current_moment = datetime.now(timezone.utc)

    # ── 1. Все активные задачи на сегодня ─────────────
    # Если задача — встреча (is_appointment = true), берём всегда.
    # Иначе — только если сфера в фокусе (is_focused = true).
    stmt = (
        select(Task)
        .join(Sphere, Task.sphere_id == Sphere.id)
        .where(
            Task.user_id == user_id,
            Task.status_id == TaskStatus.ACTIVE.value,
            Task.finish_date >= local_date,
            Task.start_date <= local_date,
            (Task.is_appointment == True) | (Sphere.is_focused == True),
        )
    )
    result = await db.execute(stmt)
    all_tasks = result.scalars().all()

    if not all_tasks:
        return None, 0

    total_tasks = len(all_tasks)

    # ── 2. Проверяем встречи ───────────────────────────
    appointments = [t for t in all_tasks if t.is_appointment]
    min_next_appointment_minutes: float = float("inf")

    for apt in appointments:
        if apt.appointment_at:
            real_start = apt.appointment_at - timedelta(minutes=apt.travel_time or 0)
            real_end = apt.appointment_at + timedelta(minutes=apt.duration)

            if real_start <= current_moment <= real_end:
                return apt, total_tasks

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
        return None, total_tasks

    # ── 5. Считаем Score ──────────────────────────────
    project_cache: dict[UUID, float | None] = {}
    sphere_cache: dict[UUID, float | None] = {}

    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = settings_result.scalar_one_or_none()
    if not settings:
        return None, total_tasks

    scored: list[tuple[TaskScore, Task]] = []
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
        scored.append((score_obj, task))

    scored.sort(key=lambda x: -x[0].total)
    return scored[0][1], total_tasks


@router.post("/select", response_model=WorkSelectResponse)
async def select_work_task(
    local_date: datetime = Query(
        ...,
        description="Сегодняшняя дата (UTC ISO 8601). "
                    "Фронт конвертирует 00:00 локального времени в UTC и передаёт сюда.",
    ),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WorkSelectResponse:
    """
    Выбрать задачу для экрана «Работа» (без обогащения).

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Запускает алгоритм, возвращает только task_id (или null).
    """
    selected_task, total_tasks = await _run_selection_algorithm(
        local_date, user_id, db,
    )
    return WorkSelectResponse(
        task_id=selected_task.id if selected_task else None,
    )


@router.get("/{task_id}", response_model=WorkResponse)
async def get_work_task(
    task_id: UUID,
    local_date: datetime = Query(
        ...,
        description="Сегодняшняя дата (UTC ISO 8601). "
                    "Фронт конвертирует 00:00 локального времени в UTC и передаёт сюда.",
    ),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WorkResponse:
    """
    Получить задачу для экрана «Работа» по task_id.

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Возвращает полную информацию для отображения на экране работы.
    """
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.user_id == user_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        return WorkResponse(task=None, total_tasks=0)

    # Загружаем настройки для delay_minutes
    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = settings_result.scalar_one_or_none()
    delay_minutes = settings.delay_minutes if settings else 60

    # Считаем общее количество активных задач на сегодня
    total_result = await db.execute(
        select(Task).where(
            Task.user_id == user_id,
            Task.status_id == TaskStatus.ACTIVE.value,
            Task.finish_date >= local_date,
            Task.start_date <= local_date,
        )
    )
    all_tasks = total_result.scalars().all()
    total_tasks = len(all_tasks)

    actual = await _read_task_actual_minutes(task.id, user_id, local_date, db)
    enriched = await _enrich_task(db, task, actual)
    return WorkResponse(task=enriched, total_tasks=total_tasks, delay_minutes=delay_minutes)
