"""Project endpoints — управление проектами пользователя."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timezone, timedelta

from db.session import get_db
from models.project import Project, ProjectStatus, ProjectStatusRef
from models.sphere import Sphere
from models.goal import Goal
from schemas.project import ProjectRead, ProjectCreate, ProjectUpdate, ProjectStatusRead
from core.auth import get_current_user_id

router = APIRouter(prefix="/projects", tags=["projects"])


# ── Вспомогательные функции ──────────────────────────


async def _read_status_ref(db: AsyncSession, status_id: int) -> ProjectStatusRef:
    """Получает запись справочника статусов. Если нет — возвращает заглушку."""
    result = await db.execute(
        select(ProjectStatusRef).where(ProjectStatusRef.id == status_id)
    )
    ref = result.scalar_one_or_none()
    return ref or ProjectStatusRef(
        id=status_id, code="unknown", name="Неизвестный", sort_order=99
    )


async def _has_active_task(project_id: UUID, db: AsyncSession) -> bool:
    """Проверяет, есть ли у проекта хотя бы одна активная задача."""
    # Пока возвращаем False — будет реализовано после создания Task
    # result = await db.execute(
    #     select(func.count(Task.id)).where(
    #         Task.project_id == project_id,
    #         Task.status_id == 1,  # TaskStatus.ACTIVE
    #     )
    # )
    # count = result.scalar() or 0
    # return count > 0
    return False


def _calc_speed(project: Project, now: datetime) -> float | None:
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


async def _enrich_project(
    project: Project, db: AsyncSession, now: datetime | None = None
) -> ProjectRead:
    """Обогащает Project данными из связанных таблиц и вычисляемыми полями."""
    if now is None:
        now = datetime.now(timezone.utc)

    # Сфера
    sphere_result = await db.execute(
        select(Sphere).where(Sphere.id == project.sphere_id)
    )
    sphere = sphere_result.scalar_one_or_none()

    # Цель (если есть)
    goal_title = None
    if project.goal_id:
        goal_result = await db.execute(
            select(Goal).where(Goal.id == project.goal_id)
        )
        goal = goal_result.scalar_one_or_none()
        if goal:
            goal_title = goal.title

    # Статус из справочника
    status_ref = await _read_status_ref(db, project.status_id)

    # Вычисляемые поля
    has_active_task = await _has_active_task(project.id, db)
    speed = _calc_speed(project, now)

    return ProjectRead(
        id=project.id,
        sphere_id=project.sphere_id,
        sphere_code=sphere.code if sphere else "",
        sphere_name=sphere.name if sphere else "",
        goal_id=project.goal_id,
        goal_title=goal_title,
        title=project.title,
        description=project.description,
        start_date=project.start_date,
        finish_date=project.finish_date,
        status_id=project.status_id,
        status_code=status_ref.code,
        status_name=status_ref.name,
        status_color=status_ref.color,
        progress=project.progress,
        has_active_task=has_active_task,
        speed=speed,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


# ── Status reference endpoints ────────────────────────


@router.get("/statuses", response_model=list[ProjectStatusRead])
async def get_project_statuses(
    db: AsyncSession = Depends(get_db),
) -> list[ProjectStatusRead]:
    """Возвращает список всех статусов проектов из справочника."""
    result = await db.execute(
        select(ProjectStatusRef).order_by(ProjectStatusRef.sort_order)
    )
    return result.scalars().all()  # type: ignore[return-value]


# ── Project CRUD endpoints ────────────────────────────


@router.get("", response_model=list[ProjectRead])
async def get_projects(
    sphere_id: UUID | None = None,
    show_all: bool = False,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectRead]:
    """
    Получить список проектов пользователя.

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Фильтрация: по сфере (sphere_id), по статусам (show_all)
    📋 По умолчанию — только активные проекты
    """
    now = datetime.now(timezone.utc)

    statement = select(Project).where(Project.user_id == user_id)

    if sphere_id:
        statement = statement.where(Project.sphere_id == sphere_id)

    if not show_all:
        # По умолчанию — только активные (status_id = 1)
        statement = statement.where(Project.status_id == ProjectStatus.ACTIVE.value)

    # Сортировка: id ASC (UUID v7 — по времени создания, от старых к новым)
    statement = statement.order_by(Project.id.asc())

    result = await db.execute(statement)
    projects = result.scalars().all()

    enriched = []
    for project in projects:
        ep = await _enrich_project(project, db, now)
        enriched.append(ep)

    return enriched


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    """
    Получить детальную информацию по одному проекту.

    🔐 Требует авторизацию (JWT Bearer token)
    """
    now = datetime.now(timezone.utc)

    project = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = project.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Проект не найден"},
        )

    return await _enrich_project(project, db, now)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    """
    Создать новый проект.

    🔐 Требует авторизацию (JWT Bearer token)
    ✅ Проверяет, что sphere_id принадлежит пользователю
    ✅ Проверяет, что goal_id (если указан) принадлежит пользователю
    """
    now = datetime.now(timezone.utc)

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

    project = Project(
        user_id=user_id,
        sphere_id=payload.sphere_id,
        goal_id=payload.goal_id,
        title=payload.title,
        description=payload.description,
        start_date=payload.start_date,
        finish_date=payload.finish_date,
        status_id=ProjectStatus.ACTIVE.value,
        progress=payload.progress,
    )

    db.add(project)
    await db.flush()
    await db.refresh(project)

    return await _enrich_project(project, db, now)


@router.put("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    """
    Обновить проект.

    🔐 Требует авторизацию (JWT Bearer token)
    🔍 Ищет проект по project_id и user_id
    """
    now = datetime.now(timezone.utc)

    project = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = project.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Проект не найден"},
        )

    update_data = payload.model_dump(exclude_unset=True)

    # Проверка sphere_id
    if "sphere_id" in update_data:
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
        valid_ids = {s.value for s in ProjectStatus}
        if update_data["status_id"] not in valid_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": f"Некорректный status_id. Допустимые: {', '.join(str(v) for v in sorted(valid_ids))}",
                },
            )

    for field, value in update_data.items():
        setattr(project, field, value)

    await db.flush()
    await db.refresh(project)

    return await _enrich_project(project, db, now)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Soft delete проекта (устанавливает status_id = 3 — CANCELLED).

    🔐 Требует авторизацию (JWT Bearer token)
    """
    project = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = project.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Проект не найден"},
        )

    project.status_id = ProjectStatus.CANCELLED.value
    db.add(project)

    return None
