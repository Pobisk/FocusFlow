"""Goal endpoints — управление целями пользователя."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy import case, func
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from db.session import get_db
from models.goal import Goal, GoalStatus
from models.sphere import Sphere
from models.project import Project
from schemas.goal import GoalRead, GoalCreate, GoalUpdate
from core.auth import get_current_user_id

router = APIRouter(prefix="/goals", tags=["goals"])


async def _enrich_goal(
    goal: Goal,
    db: AsyncSession,
    user_id: UUID,
) -> GoalRead:
    """Обогащает Goal данными из связанных таблиц (sphere, projects)."""
    # Получаем сферу
    sphere_result = await db.execute(
        select(Sphere).where(Sphere.id == goal.sphere_id)
    )
    sphere = sphere_result.scalar_one_or_none()

    # Считаем projects для этой цели
    projects_result = await db.execute(
        select(
            func.count(Project.id).label("total"),
            func.sum(
                case((Project.status == "completed", 1), else_=0)
            ).label("completed"),
        ).where(
            Project.goal_id == goal.id,
            Project.user_id == user_id,
        )
    )
    row = projects_result.one_or_none()
    total_projects = row.total or 0
    completed_projects = row.completed or 0

    # Прогресс: процент завершённых проектов
    progress = round((completed_projects / total_projects * 100), 1) if total_projects > 0 else 0.0

    # Есть ли активные проекты
    has_active_result = await db.execute(
        select(func.count(Project.id)).where(
            Project.goal_id == goal.id,
            Project.user_id == user_id,
            Project.status == "active",
        )
    )
    has_active_projects = (has_active_result.scalar() or 0) > 0

    return GoalRead(
        id=goal.id,
        sphere_id=goal.sphere_id,
        sphere_code=sphere.code if sphere else "",
        sphere_name=sphere.name if sphere else "",
        title=goal.title,
        description=goal.description,
        deadline=goal.deadline,
        status=goal.status if isinstance(goal.status, str) else goal.status.value,
        progress=progress,
        has_active_projects=has_active_projects,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )





@router.get("", response_model=list[GoalRead], status_code=status.HTTP_200_OK)
async def get_goals(
    sphere_id: UUID | None = None,
    status: str | None = "active",
    show_all: bool = False,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[GoalRead]:
    """
    Получить список целей пользователя.

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Поддерживает фильтрацию по сфере и статусу
    📊 Для каждой цели вычисляет progress и has_active_projects
    """
    statement = select(Goal).where(Goal.user_id == user_id)

    if sphere_id:
        statement = statement.where(Goal.sphere_id == sphere_id)

    if not show_all and status:
        statement = statement.where(Goal.status == status)

    # Сортировка: сначала активные, затем по deadline ASC (сначала ближайшие)
    statement = statement.order_by(
        Goal.status.asc(),
        Goal.deadline.asc().nulls_last(),
    )

    result = await db.execute(statement)
    goals = result.scalars().all()

    enriched_goals = []
    for goal in goals:
        enriched = await _enrich_goal(goal, db, user_id)
        enriched_goals.append(enriched)

    return enriched_goals


@router.get("/{goal_id}", response_model=GoalRead, status_code=status.HTTP_200_OK)
async def get_goal(
    goal_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GoalRead:
    """
    Получить детальную информацию по одной цели.

    🔐 Требует авторизацию (JWT Bearer token)
    🔍 Поиск по goal_id и user_id
    """
    goal = await db.execute(
        select(Goal).where(
            Goal.id == goal_id,
            Goal.user_id == user_id,
        )
    )
    goal = goal.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Цель не найдена"},
        )

    return await _enrich_goal(goal, db, user_id)


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: GoalCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GoalRead:
    """
    Создать новую цель.

    🔐 Требует авторизацию (JWT Bearer token)
    ✅ Проверяет, что sphere_id принадлежит пользователю
    """
    # Проверяем, что сфера принадлежит пользователю
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

    goal = Goal(
        user_id=user_id,
        sphere_id=payload.sphere_id,
        title=payload.title,
        description=payload.description,
        deadline=payload.deadline,
    )

    db.add(goal)
    await db.flush()
    await db.refresh(goal)

    return await _enrich_goal(goal, db, user_id)


@router.put("/{goal_id}", response_model=GoalRead, status_code=status.HTTP_200_OK)
async def update_goal(
    goal_id: UUID,
    payload: GoalUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GoalRead:
    """
    Обновить цель.

    🔐 Требует авторизацию (JWT Bearer token)
    🔍 Ищет цель по goal_id и user_id
    """
    goal = await db.execute(
        select(Goal).where(
            Goal.id == goal_id,
            Goal.user_id == user_id,
        )
    )
    goal = goal.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Цель не найдена"},
        )

    update_data = payload.model_dump(exclude_unset=True)

    # Если обновляется sphere_id — проверить, что новая сфера принадлежит пользователю
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

    # Если передан статус — валидируем
    if "status" in update_data:
        valid_statuses = {s.value for s in GoalStatus}
        if update_data["status"] not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error": f"Некорректный статус. Допустимые: {', '.join(valid_statuses)}"},
            )

    for field, value in update_data.items():
        setattr(goal, field, value)

    await db.flush()
    await db.refresh(goal)

    return await _enrich_goal(goal, db, user_id)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Soft delete цели (устанавливает status = "cancelled").

    🔐 Требует авторизацию (JWT Bearer token)
    """
    goal = await db.execute(
        select(Goal).where(
            Goal.id == goal_id,
            Goal.user_id == user_id,
        )
    )
    goal = goal.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Цель не найдена"},
        )

    goal.status = GoalStatus.CANCELLED
    db.add(goal)

    return None
