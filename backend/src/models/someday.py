"""SomedayMaybe model — КНМБ (Когда-нибудь может быть)."""

from uuid import UUID
from sqlmodel import Field
from models.base import UserOwnedModel


class SomedayMaybe(UserOwnedModel, table=True):
    """Запись в списке «Когда-нибудь может быть»."""

    __tablename__ = "someday_maybe"

    sphere_id: UUID = Field(
        foreign_key="spheres.id",
        nullable=False,
        index=True,
        description="Идентификатор сферы",
    )
    title: str = Field(
        max_length=200,
        nullable=False,
        description="Название",
    )
    description: str | None = Field(
        default=None,
        max_length=2000,
        nullable=True,
        description="Описание",
    )
    is_active: bool = Field(
        default=True,
        nullable=False,
        description="Признак активности",
    )
