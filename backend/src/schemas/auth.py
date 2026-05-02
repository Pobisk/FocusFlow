"""Pydantic schemas for authentication."""

from pydantic import BaseModel, Field


class AuthRequest(BaseModel):
    """Запрос авторизации."""
    login: str = Field(..., min_length=1, max_length=100, description="Логин пользователя")
    hash: str = Field(..., min_length=64, max_length=64, description="SHA-256 хэш пароля (lowercase)")


class AuthResponse(BaseModel):
    """Ответ авторизации."""
    name: str = Field(..., description="Имя пользователя")
    access_token: str = Field(..., description="JWT токен доступа")
    token_type: str = Field(default="bearer", description="Тип токена")
