"""Task endpoints — управление задачами пользователя."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timezone

from db.session import get_db
from models.task import Task, TaskStatus, TaskStatusRef
from models.sphere import Sphere
from models.project import Project
from models.goal import Goal
from schemas.task import TaskRead, TaskCreate, TaskUpdate, TaskStatusRead
from core.auth import get_current_user_id

router = APIRouter(prefix="/tasks", tags=["tasks"])


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


async def _enrich_task(
    task: Task, db: AsyncSession
) -> TaskRead:
    """Обогащает Task данными из связанных таблиц."""
    # Сфера
    sphere_result = await db.execute(
        select(Sphere).where(Sphere.id == task.sphere_id)
    )
    sphere = sphere_result.scalar_one_or_none()

    # Проект (если есть)
    project_title = None
    if task.project_id:
        project_result = await db.execute(
            select(Project).where(Project.id == task.project_id)
        )
        project = project_result.scalar_one_or_none()
        if project:
            project_title = project.title

    # Цель (если есть)
    goal_title = None
    if task.goal_id:
        goal_result = await db.execute(
            select(Goal).where(Goal.id == task.goal_id)
        )
        goal = goal_result.scalar_one_or_none()
        if goal:
            goal_title = goal.title

    # Статус из справочника
    status_ref = await _read_status_ref(db, task.status_id)

    return TaskRead(
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
        importance=task.importance,
        consequences=task.consequences,
        progress=task.progress,
        delay_to=task.delay_to,
        refusal_count=task.refusal_count,
        status_id=task.status_id,
        status_code=status_ref.code,
        status_name=status_ref.name,
        status_color=status_ref.color,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


# ── Status reference endpoints ────────────────────────


@router.get("/statuses", response_model=list[TaskStatusRead])
async def get_task_statuses(
    db: AsyncSession = Depends(get_db),
) -> list[TaskStatusRead]:
    """Возвращает список всех статусов задач из справочника."""
    result = await db.execute(
        select(TaskStatusRef).order_by(TaskStatusRef.sort_order)
    )
    return result.scalars().all()  # type: ignore[return-value]


# ── Task CRUD endpoints ────────────────────────────────


@router.get("", response_model=list[TaskRead])
async def get_tasks(
    interval_start: datetime | None = Query(
        default=None, description="Первый день интервала (UTC), 00:00"
    ),
    interval_end: datetime | None = Query(
        default=None, description="Последний день интервала (UTC), 00:00"
    ),
    sphere_id: UUID | None = None,
    project_id: UUID | None = None,
    show_all: bool = False,
    only_standalone: bool = False,
    only_appointments: bool = False,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[TaskRead]:
    """
    Получить список задач пользователя.

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Фильтрация: по интервалу, сфере, проекту, статусам, типу
    📋 По умолчанию — только активные задачи
    🔍 Фильтр по интервалу:
       finish_date >= interval_start AND start_date <= interval_end
    """
    statement = select(Task).where(Task.user_id == user_id)

    if sphere_id:
        statement = statement.where(Task.sphere_id == sphere_id)

    if project_id:
        statement = statement.where(Task.project_id == project_id)

    if interval_start and interval_end:
        statement = statement.where(
            Task.finish_date >= interval_start,
            Task.start_date <= interval_end,
        )

    if not show_all:
        # По умолчанию — только активные (status_id = 1)
        statement = statement.where(Task.status_id == TaskStatus.ACTIVE.value)

    if only_standalone:
        # Только отдельные (без проекта)
        statement = statement.where(Task.project_id.is_(None))

    if only_appointments:
        # Только встречи
        statement = statement.where(Task.is_appointment.is_(True))

    # Сортировка: start_date ASC, затем id ASC
    statement = statement.order_by(Task.start_date.asc(), Task.id.asc())

    result = await db.execute(statement)
    tasks = result.scalars().all()

    enriched = []
    for task in tasks:
        et = await _enrich_task(task, db)
        enriched.append(et)

    return enriched


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(
    task_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TaskRead:
    """
    Получить детальную информацию по одной задаче.

    🔐 Требует авторизацию (JWT Bearer token)
    """
    task = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user_id)
    )
    task = task.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Задача не найдена"},
        )

    return await _enrich_task(task, db)


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TaskRead:
    """
    Создать новую задачу.

    🔐 Требует авторизацию (JWT Bearer token)
    ✅ Проверяет, что sphere_id принадлежит пользователю
    ✅ Проверяет, что project_id (если указан) принадлежит пользователю
    ✅ Проверяет, что goal_id (если указан) принадлежит пользователю
    ✅ Для проектных задач — копирует сферу и цель из проекта
    """
    # Проверяем сферу
    sphere = await db.execute(
        select(Sphere).where(
            Sphere.id == payload.sphere_id,
            Sphere.user_id == user_id,
        )
    )
    if not sphere.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Сфера не найдена или не принадлежит пользователю"},
        )

    # Проверяем проект (если указан)
    if payload.project_id:
        project = await db.execute(
            select(Project).where(
                Project.id == payload.project_id,
                Project.user_id == user_id,
            )
        )
        project_obj = project.scalar_one_or_none()
        if not project_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "Проект не найден или не принадлежит пользователю"},
            )

    # Проверяем цель (если указана)
    if payload.goal_id:
        goal = await db.execute(
            select(Goal).where(
                Goal.id == payload.goal_id,
                Goal.user_id == user_id,
            )
        )
        if not goal.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "Цель не найдена или не принадлежит пользователю"},
            )

    # Проверка status_id
    valid_ids = {s.value for s in TaskStatus}
    if payload.status_id not in valid_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": f"Некорректный status_id. Допустимые: {', '.join(str(v) for v in sorted(valid_ids))}",
            },
        )

    task = Task(
        user_id=user_id,
        sphere_id=payload.sphere_id,
        project_id=payload.project_id,
        goal_id=payload.goal_id,
        title=payload.title,
        description=payload.description,
        is_appointment=payload.is_appointment,
        start_date=payload.start_date,
        finish_date=payload.finish_date,
        appointment_at=payload.appointment_at,
        travel_time=payload.travel_time,
        duration=payload.duration,
        importance=payload.importance,
        consequences=payload.consequences,
        progress=payload.progress,
        delay_to=payload.delay_to,
        refusal_count=payload.refusal_count,
        status_id=payload.status_id,
    )

    db.add(task)
    await db.flush()
    await db.refresh(task)

    return await _enrich_task(task, db)


@router.put("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TaskRead:
    """
    Обновить задачу.

    🔐 Требует авторизацию (JWT Bearer token)
    🔍 Ищет задачу по task_id и user_id
    ⚠️ is_appointment менять нельзя (устанавливается только при создании)
    """
    task = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user_id)
    )
    task_obj = task.scalar_one_or_none()

    if not task_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Задача не найдена"},
        )

    update_data = payload.model_dump(exclude_unset=True)

    # Нельзя менять is_appointment при редактировании
    if "is_appointment" in update_data:
        del update_data["is_appointment"]

    # Проверка sphere_id (только для отдельной задачи)
    if "sphere_id" in update_data:
        if task_obj.project_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "Для проектной задачи нельзя менять сферу"},
            )
        sphere = await db.execute(
            select(Sphere).where(
                Sphere.id == update_data["sphere_id"],
                Sphere.user_id == user_id,
            )
        )
        if not sphere.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "Сфера не найдена или не принадлежит пользователю"},
            )

    # Проверка goal_id
    if "goal_id" in update_data:
        if task_obj.project_id and update_data["goal_id"] != task_obj.goal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "Для проектной задачи нельзя менять цель"},
            )
        if update_data["goal_id"] is not None:
            goal = await db.execute(
                select(Goal).where(
                    Goal.id == update_data["goal_id"],
                    Goal.user_id == user_id,
                )
            )
            if not goal.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "error": "Цель не найдена или не принадлежит пользователю"
                    },
                )

    # Проверка status_id
    if "status_id" in update_data:
        valid_ids = {s.value for s in TaskStatus}
        if update_data["status_id"] not in valid_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": f"Некорректный status_id. Допустимые: {', '.join(str(v) for v in sorted(valid_ids))}",
                },
            )

    for field, value in update_data.items():
        setattr(task_obj, field, value)

    await db.flush()
    await db.refresh(task_obj)

    return await _enrich_task(task_obj, db)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Soft delete задачи (устанавливает status_id = 3 — CANCELLED).

    🔐 Требует авторизацию (JWT Bearer token)
    """
    task = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user_id)
    )
    task_obj = task.scalar_one_or_none()

    if not task_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Задача не найдена"},
        )

    task_obj.status_id = TaskStatus.CANCELLED.value
    db.add(task_obj)

    return None
