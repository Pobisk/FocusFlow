"""User model for authentication."""

from sqlmodel import Field, Index
from models.base import BaseModel


class User(BaseModel, table=True):
    """Сущность пользователя для авторизации."""

    __tablename__ = "users"

    name: str = Field(
        default="", max_length=200, nullable=False,
        description="Имя пользователя",
    )
    login: str = Field(
        default="", max_length=100, nullable=False, unique=True,
        description="Логин для входа",
    )
    hash: str = Field(
        default="", max_length=64, nullable=False,
        description="SHA-256 хэш пароля (64 символа, lowercase)",
    )
    active: bool = Field(
        default=True, nullable=False,
        description="Статус активности",
    )

    __table_args__ = (
        Index("ix_users_login", "login"),
    )
