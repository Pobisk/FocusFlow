"""Sphere endpoints - life areas CRUD and satisfaction history."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from db.session import get_db
from models.sphere import Sphere, SphereSatisfactionHistory
from schemas.sphere import (
    SphereRead,
    SphereCreate,
    SphereUpdate,
    SphereSatisfactionHistoryRead,
)
from core.auth import get_current_user_id
from uuid import UUID

router = APIRouter(prefix="/spheres", tags=["spheres"])


@router.get("", response_model=list[SphereRead], status_code=status.HTTP_200_OK)
async def get_spheres(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[Sphere]:
    """
    Получить список активных сфер жизни для текущего пользователя.

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Возвращает только активные сферы, отсортированные по полю order
    """
    statement = (
        select(Sphere)
        .where(Sphere.user_id == user_id, Sphere.is_active == True)
        .order_by(Sphere.order)
    )

    result = await db.execute(statement)
    spheres = result.scalars().all()

    return list(spheres)


@router.post("", response_model=SphereRead, status_code=status.HTTP_201_CREATED)
async def create_sphere(
    payload: SphereCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Sphere:
    """
    Создать новую сферу жизни.

    🔐 Требует авторизацию (JWT Bearer token)
    ✅ Проверяет уникальность code в рамках user_id
    """
    # Проверка уникальности code в рамках user_id
    existing = await db.execute(
        select(Sphere).where(
            Sphere.user_id == user_id,
            Sphere.code == payload.code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": f"Сфера с кодом '{payload.code}' уже существует"},
        )

    sphere = Sphere(
        user_id=user_id,
        code=payload.code,
        name=payload.name,
        order=payload.order,
        satisfaction=payload.satisfaction,
    )

    db.add(sphere)
    await db.flush()
    await db.refresh(sphere)

    # Сохраняем начальное значение satisfaction в историю
    history_entry = SphereSatisfactionHistory(
        user_id=user_id,
        sphere_id=sphere.id,
        satisfaction=sphere.satisfaction,
        changed_at=datetime.now(timezone.utc),
    )
    db.add(history_entry)

    return sphere


@router.put("/{sphere_id}", response_model=SphereRead, status_code=status.HTTP_200_OK)
async def update_sphere(
    sphere_id: UUID,
    payload: SphereUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Sphere:
    """
    Обновить сферу жизни.

    🔐 Требует авторизацию (JWT Bearer token)
    🔍 Ищет сферу по sphere_id и user_id
    """
    sphere = await db.execute(
        select(Sphere).where(
            Sphere.id == sphere_id,
            Sphere.user_id == user_id,
        )
    )
    sphere = sphere.scalar_one_or_none()

    if not sphere:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Сфера не найдена"},
        )

    # Отслеживаем изменение satisfaction для записи в историю
    old_satisfaction = sphere.satisfaction

    # Обновляем только переданные поля
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sphere, field, value)

    await db.flush()
    await db.refresh(sphere)

    # Если satisfaction изменился — сохраняем в историю
    if "satisfaction" in update_data and old_satisfaction != sphere.satisfaction:
        history_entry = SphereSatisfactionHistory(
            user_id=user_id,
            sphere_id=sphere.id,
            satisfaction=sphere.satisfaction,
            changed_at=datetime.now(timezone.utc),
        )
        db.add(history_entry)

    return sphere


@router.delete("/{sphere_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sphere(
    sphere_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Soft delete сферы жизни (устанавливает is_active = False).

    🔐 Требует авторизацию (JWT Bearer token)
    🔍 Ищет сферу по sphere_id и user_id
    """
    sphere = await db.execute(
        select(Sphere).where(
            Sphere.id == sphere_id,
            Sphere.user_id == user_id,
        )
    )
    sphere = sphere.scalar_one_or_none()

    if not sphere:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Сфера не найдена"},
        )

    sphere.is_active = False
    db.add(sphere)

    return None


@router.get(
    "/{sphere_id}/history",
    response_model=list[SphereSatisfactionHistoryRead],
    status_code=status.HTTP_200_OK,
)
async def get_sphere_satisfaction_history(
    sphere_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[SphereSatisfactionHistory]:
    """
    Получить историю изменения satisfaction для сферы.

    🔐 Требует авторизацию (JWT Bearer token)
    🔍 Проверяет, что сфера принадлежит пользователю
    """
    # Проверяем, что сфера принадлежит пользователю
    sphere = await db.execute(
        select(Sphere).where(
            Sphere.id == sphere_id,
            Sphere.user_id == user_id,
        )
    )
    if not sphere.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Сфера не найдена"},
        )

    statement = (
        select(SphereSatisfactionHistory)
        .where(
            SphereSatisfactionHistory.sphere_id == sphere_id,
            SphereSatisfactionHistory.user_id == user_id,
        )
        .order_by(SphereSatisfactionHistory.changed_at)
    )

    result = await db.execute(statement)
    history = result.scalars().all()

    return list(history)
