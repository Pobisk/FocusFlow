"""Today endpoint — сборка данных для экрана «Сегодня»."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
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
from schemas.today import TodayResponse, TodaySummary, TodayTaskRead
from core.auth import get_current_user_id

router = APIRouter(prefix="/today", tags=["today"])


# ── Константы кирпичиков ──────────────────────────────

BRICK_COMPLETED = "completed"       # зелёный
BRICK_OVERDUE = "overdue"           # красный
BRICK_NEAR_DEADLINE = "near_deadline"  # жёлтый
BRICK_ACTIVE = "active"             # без кирпичика
BRICK_CANCELLED = "cancelled"       # синий


# ── Вспомогательные функции ──────────────────────────


async def _read_status_ref(db: AsyncSession, status_id: int) -> TaskStatusRef:
    """Получает запись справочника статусов. Если нет — возвращает заглушку."""
    result = await db.execute(
        select(TaskStatusRef).where(TaskStatusRef.id == status_id)
    )
    ref = result.scalar_one_or_none()
    return ref or TaskStatusRef(
        id=status_id, code="unknown", name="Неизвестный", sort_order=99
    )


def _compute_brick_code(
    status_id: int, finish_date: datetime, today: datetime, deadline_near: int,
) -> str:
    """Вычисляет код кирпичика по правилам экрана «Сегодня»."""
    if status_id == TaskStatus.COMPLETED.value:
        return BRICK_COMPLETED
    if status_id == TaskStatus.CANCELLED.value:
        return BRICK_CANCELLED
    if status_id == TaskStatus.ACTIVE.value:
        if finish_date <= today:
            return BRICK_OVERDUE
        if finish_date <= today + timedelta(days=deadline_near):
            return BRICK_NEAR_DEADLINE
        return BRICK_ACTIVE
    return BRICK_ACTIVE


# ── Эндпоинт ──────────────────────────────────────────


@router.get("", response_model=TodayResponse)
async def get_today(
    local_date: datetime = Query(
        ...,
        description="Сегодняшняя дата (UTC ISO 8601). "
                    "Фронт конвертирует 00:00 локального времени в UTC и передаёт сюда.",
    ),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TodayResponse:
    """
    Получить данные для экрана «Сегодня».

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Возвращает сводку и список задач на сегодня.
    """

    # Загружаем deadline_near из настроек пользователя
    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = settings_result.scalar_one_or_none()
    deadline_near = settings.deadline_near if settings else 3

    # ── 1. Задачи на сегодня ──────────────────────────
    # today >= start_date AND today <= finish_date
    stmt = select(Task).where(
        Task.user_id == user_id,
        Task.finish_date >= local_date,
        Task.start_date <= local_date,
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    if not tasks:
        return TodayResponse(
            date=local_date.isoformat(),
            summary=TodaySummary(
                planned_minutes=480,
                actual_minutes=0,
                goal_minutes=0,
            ),
            tasks=[],
        )

    # ── 2. Подтягиваем TaskLog на сегодня ──────────────
    task_ids = [t.id for t in tasks]
    log_result = await db.execute(
        select(TaskLog).where(
            TaskLog.task_id.in_(task_ids),
            TaskLog.user_id == user_id,
            TaskLog.log_date == local_date,
        )
    )
    log_rows = log_result.scalars().all()
    log_map: dict[UUID, int] = {row.task_id: row.minutes for row in log_rows}

    # ── 3. Обогащаем задачи ────────────────────────────
    enriched: list[TodayTaskRead] = []
    total_actual = 0
    total_goal = 0

    for task in tasks:
        actual = log_map.get(task.id, 0)
        total_actual += actual

        # Сфера
        sphere_res = await db.execute(
            select(Sphere).where(Sphere.id == task.sphere_id)
        )
        sphere = sphere_res.scalar_one_or_none()

        # Проект
        project_title = None
        if task.project_id:
            proj_res = await db.execute(
                select(Project).where(Project.id == task.project_id)
            )
            proj = proj_res.scalar_one_or_none()
            if proj:
                project_title = proj.title

        # Цель
        goal_title = None
        if task.goal_id:
            goal_res = await db.execute(
                select(Goal).where(Goal.id == task.goal_id)
            )
            goal = goal_res.scalar_one_or_none()
            if goal:
                goal_title = goal.title
                total_goal += actual  # целевое время = факт по задачам с goal_id

        # Статус
        status_ref = await _read_status_ref(db, task.status_id)

        # Кирпичик
        brick_code = _compute_brick_code(
            task.status_id, task.finish_date, local_date, deadline_near
        )

        enriched.append(TodayTaskRead(
            id=task.id,
            sphere_id=task.sphere_id,
            sphere_code=sphere.code if sphere else "",
            sphere_name=sphere.name if sphere else "",
            project_id=task.project_id,
            project_title=project_title,
            goal_id=task.goal_id,
            goal_title=goal_title,
            title=task.title,
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
            actual_minutes=actual,
            brick_code=brick_code,
            created_at=task.created_at,
            updated_at=task.updated_at,
        ))

    # ── 4. Сортируем по правилам экрана «Сегодня» ─────
    def sort_key(t: TodayTaskRead) -> tuple[int, UUID]:
        """(группа, id) для сортировки."""
        brick_order = {
            BRICK_COMPLETED: 1,
            BRICK_OVERDUE: 2,
            BRICK_NEAR_DEADLINE: 3,
            BRICK_ACTIVE: 4,
            BRICK_CANCELLED: 5,
        }
        return (brick_order.get(t.brick_code, 6), t.id)

    enriched.sort(key=sort_key)

    return TodayResponse(
        date=local_date.isoformat(),
        summary=TodaySummary(
            planned_minutes=480,
            actual_minutes=total_actual,
            goal_minutes=total_goal,
        ),
        tasks=enriched,
    )
