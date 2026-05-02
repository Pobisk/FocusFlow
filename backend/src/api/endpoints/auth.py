"""Authentication endpoint."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from models.user import User
from schemas.auth import AuthRequest, AuthResponse
from core.jwt import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("", response_model=AuthResponse, status_code=status.HTTP_200_OK)
async def authenticate(request: AuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Авторизация пользователя по логину и хэшу пароля.
    
    - **login**: логин пользователя
    - **hash**: SHA-256 хэш пароля (64 символа, нижний регистр)
    
    Возвращает имя пользователя и JWT токен (срок действия 6 часов).
    """
    # Поиск пользователя по логину
    statement = select(User).where(User.login == request.login)
    result = await db.execute(statement)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Не верные логин или пароль"},
        )
    
    # Сравнение хэша пароля
    if user.hash != request.hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Не верные логин или пароль"},
        )
    
    # Проверка активности
    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "Пользователь заблокирован"},
        )
    
    # Генерация JWT с claims
    token_data = {
        "sub": str(user.id),
        "login": user.login,
        "name": user.name,
    }
    access_token = create_access_token(data=token_data)
    
    return AuthResponse(name=user.name, access_token=access_token)
