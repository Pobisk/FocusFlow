"""Sphere endpoint - life areas reference."""
from fastapi import APIRouter, Depends, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from models.sphere import Sphere
from core.auth import get_current_user_id
from uuid import UUID

router = APIRouter(prefix="/sphere", tags=["sphere"])


@router.get("", response_model=list[Sphere], status_code=status.HTTP_200_OK)
async def get_spheres(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> list[Sphere]:
    """
    Получить список активных сфер жизни для текущего пользователя.
    
    🔐 Требует авторизацию (JWT Bearer token)
    📋 Возвращает только активные сферы, отсортированные по полю order
    """
    statement = (
        select(Sphere)
        .where(
            Sphere.user_id == user_id,
            Sphere.is_active == True
        )
        .order_by(Sphere.order)
    )
    
    result = await db.execute(statement)
    spheres = result.all()
    
    return spheres
