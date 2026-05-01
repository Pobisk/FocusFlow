"""User model for authentication."""

from sqlmodel import Field, Index
from models.base import BaseModel


class User(BaseModel, table=True):
    """Сущность пользователя для авторизации."""
    
    __tablename__ = "users"
    
    name: str = Field(..., nullable=False, description="Имя пользователя")
    login: str = Field(..., nullable=False, unique=True, description="Логин для входа")
    hash: str = Field(..., nullable=False, description="MD5 хэш пароля (32 символа, lowercase)")
    active: bool = Field(..., nullable=False, description="Статус активности")
    
    __table_args__ = (
        Index("ix_users_login", "login"),
        Index("ix_users_created_at", "created_at"),
    )
