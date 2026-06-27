"""UserSettings model — настройки пользователя для алгоритмов и UI.

Все настройки хранятся в одной записи на пользователя (1:1 с User).
Значения по умолчанию задаются в модели и используются при первом создании.
"""

from sqlmodel import Field
from models.base import UserOwnedModel


class UserSettings(UserOwnedModel, table=True):
    """Настройки пользователя.

    Единственная запись на пользователя (user_id — уникальный).
    """

    __tablename__ = "user_settings"

    # ── Коэффициенты для алгоритма выбора задачи ──────
    w_proactive: float = Field(default=1.0, nullable=False)
    w_importance: float = Field(default=1.0, nullable=False)
    w_consequences: float = Field(default=1.0, nullable=False)
    w_urgency: float = Field(default=1.0, nullable=False)
    w_refusals: float = Field(default=1.0, nullable=False)
    w_project_speed: float = Field(default=1.0, nullable=False)
    w_sphere_satisfaction: float = Field(default=1.0, nullable=False)

    # ── Для экрана "Работа" ──────────────────────────
    delay_minutes: int = Field(default=60, nullable=False, ge=1)

    # ── Для экрана "Сегодня" ─────────────────────────
    deadline_near: int = Field(default=3, nullable=False, ge=1)
