# Import base first
from .base import BaseModel, UserOwnedModel

# Import all models here (order matters for FK dependencies)
from .user import User
from .sphere import Sphere, SphereSatisfactionHistory
from .goal import Goal, GoalStatusRef
from .user_settings import UserSettings
from .project import Project, ProjectStatusRef

# Optional: export for convenient imports elsewhere
__all__ = [
    "BaseModel",
    "UserOwnedModel",
    "User",
    "UserSettings",
    "Sphere",
    "SphereSatisfactionHistory",
    "Goal",
    "GoalStatusRef",
    "Project",
    "ProjectStatusRef",
]
