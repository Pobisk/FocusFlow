"""Goal endpoints — управление целями пользователя."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from db.session import get_db
from models.goal import Goal, GoalStatus, GoalStatusRef
from models.sphere import Sphere
from schemas.goal import GoalRead, GoalCreate, GoalUpdate, GoalStatusRead
from core.auth import get_current_user_id

router = APIRouter(prefix="/goals", tags=["goals"])


# ── Вспомогательные функции ──────────────────────────


async def _read_status_ref(db: AsyncSession, status_id: int) -> GoalStatusRef:
    """Получает запись справочника статусов. Если нет — возвращает заглушку."""
    result = await db.execute(
        select(GoalStatusRef).where(GoalStatusRef.id == status_id)
    )
    ref = result.scalar_one_or_none()
    return ref or GoalStatusRef(id=status_id, code="unknown", name="Неизвестный", sort_order=99)


async def _enrich_goal(goal: Goal, db: AsyncSession) -> GoalRead:
    """Обогащает Goal данными из связанных таблиц (sphere, status_ref)."""
    # Сфера
    sphere_result = await db.execute(
        select(Sphere).where(Sphere.id == goal.sphere_id)
    )
    sphere = sphere_result.scalar_one_or_none()

    # Статус из справочника
    status_ref = await _read_status_ref(db, goal.status_id)

    return GoalRead(
        id=goal.id,
        sphere_id=goal.sphere_id,
        sphere_code=sphere.code if sphere else "",
        sphere_name=sphere.name if sphere else "",
        title=goal.title,
        description=goal.description,
        deadline=goal.deadline,
        status_id=goal.status_id,
        status_code=status_ref.code,
        status_name=status_ref.name,
        status_color=status_ref.color,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


# ── Status reference endpoints ────────────────────────


@router.get("/statuses", response_model=list[GoalStatusRead])
async def get_goal_statuses(
    db: AsyncSession = Depends(get_db),
) -> list[GoalStatusRead]:
    """Возвращает список всех статусов целей из справочника."""
    result = await db.execute(
        select(GoalStatusRef).order_by(GoalStatusRef.sort_order)
    )
    return result.scalars().all()  # type: ignore[return-value]


# ── Goal CRUD endpoints ──────────────────────────────


@router.get("", response_model=list[GoalRead])
async def get_goals(
    sphere_id: UUID | None = None,
    status_id: int | None = None,
    show_all: bool = False,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[GoalRead]:
    """
    Получить список целей пользователя.

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Поддерживает фильтрацию по сфере и статусу
    """
    statement = select(Goal).where(Goal.user_id == user_id)

    if sphere_id:
        statement = statement.where(Goal.sphere_id == sphere_id)

    if not show_all and status_id is None:
        # По умолчанию — только активные (status_id = 1)
        statement = statement.where(Goal.status_id == GoalStatus.ACTIVE.value)
    elif status_id is not None:
        statement = statement.where(Goal.status_id == status_id)

    # Сортировка: deadline ASC (сначала ближайшие)
    statement = statement.order_by(Goal.deadline.asc().nulls_last())

    result = await db.execute(statement)
    goals = result.scalars().all()

    enriched_goals = []
    for goal in goals:
        enriched = await _enrich_goal(goal, db)
        enriched_goals.append(enriched)

    return enriched_goals


@router.get("/{goal_id}", response_model=GoalRead)
async def get_goal(
    goal_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> GoalRead:
    """
    Получить детальную информацию по одной цели.

    🔐 Требует авторизацию (JWT Bearer token)
    """
    goal = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
    )
    goal = goal.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Цель не найдена"},
        )

    return await _enrich_goal(goal, db)


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

    goal = Goal(
        user_id=user_id,
        sphere_id=payload.sphere_id,
        title=payload.title,
        description=payload.description,
        deadline=payload.deadline,
        status_id=GoalStatus.ACTIVE.value,
    )

    db.add(goal)
    await db.flush()
    await db.refresh(goal)

    return await _enrich_goal(goal, db)


@router.put("/{goal_id}", response_model=GoalRead)
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
    ✅ Поддерживает смену статуса (можно вернуть отменённую/завершённую в работу)
    """
    goal = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
    )
    goal = goal.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Цель не найдена"},
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

    # Проверка status_id
    if "status_id" in update_data:
        valid_ids = {s.value for s in GoalStatus}
        if update_data["status_id"] not in valid_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": f"Некорректный status_id. Допустимые: {', '.join(str(v) for v in sorted(valid_ids))}",
                },
            )

    for field, value in update_data.items():
        setattr(goal, field, value)

    await db.flush()
    await db.refresh(goal)

    return await _enrich_goal(goal, db)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Soft delete цели (устанавливает status_id = 3 — CANCELLED).

    🔐 Требует авторизацию (JWT Bearer token)
    """
    goal = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user_id)
    )
    goal = goal.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Цель не найдена"},
        )

    goal.status_id = GoalStatus.CANCELLED.value
    db.add(goal)

    return None
