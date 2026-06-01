"""
Registry of all SQLModel models for Alembic autogeneration.

This file ensures all models are imported so their metadata
is registered with BaseModel.metadata before Alembic runs.
"""

# Import base first
from .base import BaseModel, UserOwnedModel

# Import all models here (order matters for FK dependencies)
from .user import User
from .sphere import Sphere, SphereSatisfactionHistory
from .goal import Goal
from .project import Project

# Optional: export for convenient imports elsewhere
__all__ = [
    "BaseModel",
    "UserOwnedModel",
    "User",
    "Sphere",
    "SphereSatisfactionHistory",
    "Goal",
    "Project",
]
