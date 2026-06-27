"""TaskLog endpoints — учёт фактического времени по задачам."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from db.session import get_db
from models.task_log import TaskLog
from models.task import Task
from schemas.task_log import TaskLogRead, TaskLogCreate
from core.auth import get_current_user_id

router = APIRouter(prefix="/tasks/{task_id}/log", tags=["task_log"])


@router.get("", response_model=list[TaskLogRead])
async def get_task_log(
    task_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[TaskLogRead]:
    """
    Получить все записи трудозатрат по задаче.
    Сортировка: log_date ASC.
    """
    # Проверяем, что задача принадлежит пользователю
    task = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user_id)
    )
    if not task.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Задача не найдена"},
        )

    result = await db.execute(
        select(TaskLog)
        .where(TaskLog.task_id == task_id, TaskLog.user_id == user_id)
        .order_by(TaskLog.log_date.asc())
    )
    return result.scalars().all()  # type: ignore[return-value]


@router.post("", response_model=TaskLogRead, status_code=status.HTTP_201_CREATED)
async def upsert_task_log(
    task_id: UUID,
    payload: TaskLogCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TaskLogRead:
    """
    Создать или обновить запись трудозатрат по задаче.

    Если запись с (task_id, log_date) уже существует — обновляет minutes.
    Если нет — создаёт новую.
    """
    # Проверяем, что задача принадлежит пользователю
    task = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user_id)
    )
    if not task.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Задача не найдена"},
        )

    # Ищем существующую запись
    existing = await db.execute(
        select(TaskLog).where(
            TaskLog.task_id == task_id,
            TaskLog.log_date == payload.log_date,
            TaskLog.user_id == user_id,
        )
    )
    log_entry = existing.scalar_one_or_none()

    if log_entry:
        # Обновляем
        log_entry.minutes = payload.minutes
        db.add(log_entry)
        await db.flush()
        await db.refresh(log_entry)
        return log_entry  # type: ignore[return-value]
    else:
        # Создаём
        log_entry = TaskLog(
            user_id=user_id,
            task_id=task_id,
            log_date=payload.log_date,
            minutes=payload.minutes,
        )
        db.add(log_entry)
        await db.flush()
        await db.refresh(log_entry)
        return log_entry  # type: ignore[return-value]
