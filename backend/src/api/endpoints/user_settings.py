"""UserSettings endpoints — получение и обновление настроек пользователя."""

from fastapi import APIRouter, Depends, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from db.session import get_db
from models.user_settings import UserSettings
from schemas.user_settings import UserSettingsRead, UserSettingsUpdate
from core.auth import get_current_user_id

router = APIRouter(prefix="/settings", tags=["settings"])


async def _get_or_create_settings(
    user_id: UUID,
    db: AsyncSession,
) -> UserSettings:
    """Возвращает настройки пользователя, создаёт с дефолтами если нет."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(user_id=user_id)
        db.add(settings)
        await db.flush()
        await db.refresh(settings)

    return settings


@router.get(
    "",
    response_model=UserSettingsRead,
    status_code=status.HTTP_200_OK,
)
async def get_settings(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> UserSettings:
    """
    Получить настройки текущего пользователя.

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Если настройки ещё не созданы — возвращает с дефолтными значениями
    """
    return await _get_or_create_settings(user_id, db)


@router.put(
    "",
    response_model=UserSettingsRead,
    status_code=status.HTTP_200_OK,
)
async def update_settings(
    payload: UserSettingsUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> UserSettings:
    """
    Обновить настройки текущего пользователя.

    🔐 Требует авторизацию (JWT Bearer token)
    📋 Обновляются только переданные поля
    """
    settings = await _get_or_create_settings(user_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    await db.flush()
    await db.refresh(settings)

    return settings
