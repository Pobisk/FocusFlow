# backend/src/models/base.py
from sqlmodel import Field, SQLModel
from uuid import UUID
from datetime import datetime, timezone
from uuid6 import uuid7


class BaseModel(SQLModel):
    """Базовая модель для всех сущностей с UUID v7"""
    
    id: UUID = Field(
        default_factory=uuid7,      # ← UUID v7 вместо uuid4
        primary_key=True,
        index=True,                 # Индекс по PK (важно для JOIN)
        nullable=False
    )
    
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),  # ← timezone-aware
        index=True,                 # Отдельный индекс для сортировки по времени
        nullable=False
    )
    
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    class Config:
        """SQLModel config"""
        from_attributes = True
        # ✅ UUID будет сериализоваться как строка в JSON
        json_encoders = {
            UUID: lambda v: str(v),
            datetime: lambda v: v.isoformat() if v else None
        }
