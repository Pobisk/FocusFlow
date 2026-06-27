"""TaskLog model — фактическое время выполнения задачи."""

from datetime import datetime
from uuid import UUID
from sqlmodel import Field, UniqueConstraint
from models.base import UserOwnedModel, UTCDateTime


class TaskLog(UserOwnedModel, table=True):
    """Фактическое время, затраченное на задачу в определённый день.

    Уникальность: для одного пользователя не может быть двух записей
    по одной задаче на одинаковую дату.
    """

    __tablename__ = "task_time_log"

    __table_args__ = (
        UniqueConstraint(
            "task_id", "user_id", "log_date",
            name="uq_task_log_task_user_date",
        ),
    )

    task_id: UUID = Field(
        foreign_key="tasks.id",
        nullable=False,
        index=True,
        description="Идентификатор задачи",
    )
    log_date: datetime = Field(
        nullable=False,
        sa_type=UTCDateTime,
        description="Дата (UTC, 00:00 локального времени)",
    )
    minutes: int = Field(
        nullable=False,
        description="Фактическое время в минутах",
    )
