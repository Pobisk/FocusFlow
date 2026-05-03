"""Sphere model for life areas reference."""
from sqlmodel import Field, Index
from sqlalchemy import Column, Numeric
from models.base import BaseModel
from uuid import UUID


class Sphere(BaseModel, table=True):
    """Сущность сферы жизни для персональной настройки пользователя."""

    __tablename__ = "spheres"

    # 🔗 Foreign Key to User (UUID v7)
    user_id: UUID = Field(
        foreign_key="users.id",
        ondelete="CASCADE",
        index=True,
        nullable=False
    )
    
    # 🏷️ Код сферы (например: "Ф", "Р", "Б", "С", "Ло", "Фх", "М", "Мч", "Кв", "Квс")
    code: str = Field(
        max_length=10,
        nullable=False,
        description="Краткий код сферы жизни"
    )
    
    # 📝 Наименование сферы
    name: str = Field(
        max_length=100,
        nullable=False,
        description="Полное наименование сферы"
    )
    
    # 🔢 Порядок сортировки
    order: int = Field(
        nullable=False,
        description="Порядок отображения сферы в списке"
    )
    
    # ✅ Признак активности
    is_active: bool = Field(
        default=True,
        nullable=False,
        description="Признак активности сферы"
    )
    
    # ⭐ Оценка удовлетворённости (1.0 - 5.0, с точностью до десятых)
    satisfaction: float = Field(
        sa_column=Column(Numeric(precision=3, scale=1)),  # DECIMAL(3,1): 1.0 ... 5.0
        nullable=False,
        ge=1.0,
        le=5.0,
        description="Оценка удовлетворённости сферой от 1.0 до 5.0"
    )

    __table_args__ = (
        Index("ix_spheres_user_id_order", "user_id", "order"),
        Index("ix_spheres_is_active", "is_active"),
    )
