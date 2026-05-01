"""
Registry of all SQLModel models for Alembic autogeneration.

This file ensures all models are imported so their metadata
is registered with BaseModel.metadata before Alembic runs.
"""

# Import base first
from .base import BaseModel

# Import all models here (order matters for FK dependencies)
from .user import User

# Optional: export for convenient imports elsewhere
__all__ = [
    "BaseModel",
    "User",
    # "Task",  # раскомментируйте, когда создадите другие модели
    # "File",
]
