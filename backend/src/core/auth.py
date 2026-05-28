"""Authentication dependencies for protected routes."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.jwt import decode_access_token
from models.user import User
from uuid import UUID

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> User:
    """
    Извлекает данные пользователя из JWT-токена и возвращает объект User
    с заполненными полями id, login, name (без запроса в БД).

    🔐 Требует заголовок: Authorization: Bearer <token>
    🔥 Raises HTTPException 401 при ошибках
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Требуется авторизация"},
        )

    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Неверный или истёкший токен"},
        )

    # Собираем User из claims JWT (без похода в БД)
    return User(
        id=UUID(payload["sub"]),
        login=payload.get("login", ""),
        name=payload.get("name", ""),
    )


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security)
) -> UUID:
    """
    Извлекает user_id из JWT токена.

    🔐 Требует заголовок: Authorization: Bearer <token>
    🔥 Raises HTTPException 401/403 при ошибках
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Отсутствует токен авторизации"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Неверный или истёкший токен"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UUID(payload["sub"])
