"""Authentication dependencies for protected routes."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.jwt import decode_access_token
from uuid import UUID

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """
    Dependency для получения данных текущего пользователя из JWT.
    Используется в защищённых endpoint'ах.
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
    
    return payload

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
