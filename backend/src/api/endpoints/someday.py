"""SomedayMaybe endpoints — КНМБ (Когда-нибудь может быть)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timezone

from db.session import get_db
from models.someday import SomedayMaybe
from models.sphere import Sphere
from schemas.someday import SomedayMaybeRead, SomedayMaybeCreate, SomedayMaybeUpdate
from core.auth import get_current_user_id

router = APIRouter(prefix="/someday", tags=["someday"])


def _build_read(
    rec: SomedayMaybe, sphere_code: str | None, now: datetime
) -> SomedayMaybeRead:
    """Собрать SomedayMaybeRead с вычислением days_exist и sphere_code."""
    days_exist: int | None = None
    if rec.is_active and rec.created_at:
        delta = now - rec.created_at.replace(tzinfo=timezone.utc)
        days_exist = delta.days
    return SomedayMaybeRead(
        id=rec.id,
        sphere_id=rec.sphere_id,
        sphere_code=sphere_code or "",
        title=rec.title,
        description=rec.description,
        is_active=rec.is_active,
        days_exist=days_exist,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


@router.get("", response_model=list[SomedayMaybeRead])
async def get_someday_list(
    show_all: bool = Query(default=False, description="Показать все, включая неактивные"),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[SomedayMaybeRead]:
    """Получить список КНМБ."""
    query = (
        select(SomedayMaybe, Sphere.code)
        .outerjoin(Sphere, SomedayMaybe.sphere_id == Sphere.id)
        .where(SomedayMaybe.user_id == user_id)
    )

    if not show_all:
        query = query.where(SomedayMaybe.is_active == True)

    query = query.order_by(SomedayMaybe.id.desc())

    result = await db.execute(query)
    rows = result.all()

    now = datetime.now(timezone.utc)
    return [_build_read(rec, code, now) for rec, code in rows]


@router.post("", response_model=SomedayMaybeRead, status_code=status.HTTP_201_CREATED)
async def create_someday(
    payload: SomedayMaybeCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SomedayMaybeRead:
    """Создать запись КНМБ."""
    sphere = await db.execute(
        select(Sphere).where(Sphere.id == payload.sphere_id, Sphere.user_id == user_id)
    )
    sphere_obj = sphere.scalar_one_or_none()

    record = SomedayMaybe(
        user_id=user_id,
        sphere_id=payload.sphere_id,
        title=payload.title,
        description=payload.description,
        is_active=payload.is_active,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)

    now = datetime.now(timezone.utc)
    return _build_read(record, sphere_obj.code if sphere_obj else None, now)


@router.get("/{record_id}", response_model=SomedayMaybeRead)
async def get_someday(
    record_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SomedayMaybeRead:
    """Получить запись КНМБ по ID."""
    query = (
        select(SomedayMaybe, Sphere.code)
        .outerjoin(Sphere, SomedayMaybe.sphere_id == Sphere.id)
        .where(SomedayMaybe.id == record_id, SomedayMaybe.user_id == user_id)
    )
    result = await db.execute(query)
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Запись не найдена"},
        )

    rec, code = row
    now = datetime.now(timezone.utc)
    return _build_read(rec, code, now)


@router.put("/{record_id}", response_model=SomedayMaybeRead)
async def update_someday(
    record_id: UUID,
    payload: SomedayMaybeUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SomedayMaybeRead:
    """Обновить запись КНМБ."""
    record = await db.execute(
        select(SomedayMaybe).where(
            SomedayMaybe.id == record_id,
            SomedayMaybe.user_id == user_id,
        )
    )
    rec = record.scalar_one_or_none()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Запись не найдена"},
        )

    sphere = await db.execute(
        select(Sphere).where(Sphere.id == payload.sphere_id, Sphere.user_id == user_id)
    )
    sphere_obj = sphere.scalar_one_or_none()

    rec.sphere_id = payload.sphere_id
    rec.title = payload.title
    rec.description = payload.description
    rec.is_active = payload.is_active
    db.add(rec)
    await db.flush()
    await db.refresh(rec)

    now = datetime.now(timezone.utc)
    return _build_read(rec, sphere_obj.code if sphere_obj else None, now)
