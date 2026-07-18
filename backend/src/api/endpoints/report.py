"""Report endpoints — формирование отчёта о трудозатратах."""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta, date
from typing import Literal

from db.session import get_db
from models.task import Task
from models.task_log import TaskLog
from core.auth import get_current_user_id
from schemas.report import ReportItem, ReportResponse
from uuid import UUID

import structlog

router = APIRouter(prefix="/report", tags=["report"])

logger = structlog.get_logger(__name__)

PLAN_PER_DAY = 480  # 8 часов * 60 минут

MONTH_NAMES_SHORT = ["", "янв", "фев", "мар", "апр", "май", "июн",
                      "июл", "авг", "сен", "окт", "ноя", "дек"]

DAY_CAPTIONS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"]


def _weeks_in_interval(first_day: datetime, last_day: datetime, local_start: date) -> list[tuple[datetime, datetime]]:
    """Возвращает список (пн, вс) недель, входящих в интервал (>=4 дней внутри).
    Все даты в UTC.
    local_start — первый день интервала в локальном времени клиента (для определения дня недели).
    """
    monday = first_day - timedelta(days=local_start.weekday())

    weeks: list[tuple[datetime, datetime]] = []
    while monday <= last_day:
        sunday = monday + timedelta(days=6)
        overlap_start = max(monday, first_day)
        overlap_end = min(sunday, last_day)
        overlap_days = (overlap_end - overlap_start).days + 1
        if overlap_days >= 4:
            weeks.append((monday, sunday))
            # logger.info("report_week_added",
            #            monday=monday.isoformat(), sunday=sunday.isoformat())
        monday += timedelta(days=7)

    return weeks


async def _get_fact_minutes(
    db: AsyncSession,
    user_id: UUID,
    range_start: datetime,
    range_end: datetime,
    is_goal: bool = False,
) -> int:
    """Возвращает суммарное количество минут трудозатрат за диапазон.
    Если is_goal=True — только для задач, привязанных к целям (goal_id IS NOT NULL).
    """
    query = select(
        func.coalesce(func.sum(TaskLog.minutes), 0)
    ).join(
        Task, TaskLog.task_id == Task.id
    ).where(
        TaskLog.user_id == user_id,
        TaskLog.log_date >= range_start,
        TaskLog.log_date <= range_end,
    )

    if is_goal:
        query = query.where(Task.goal_id.is_not(None))

    result = await db.execute(query)
    return int(result.scalar() or 0)


def _build_item(order: int, caption: str,
                plan_minutes: int, fact_minutes: int, goal_minutes: int) -> ReportItem:
    fact_pct = (fact_minutes / plan_minutes * 100) if plan_minutes > 0 else 0.0
    goal_pct = (goal_minutes / plan_minutes * 100) if plan_minutes > 0 else 0.0
    return ReportItem(
        order=order,
        caption=caption,
        plan_minutes=plan_minutes,
        fact_minutes=fact_minutes,
        fact_percent=round(fact_pct, 1),
        goal_minutes=goal_minutes,
        goal_percent=round(goal_pct, 1),
    )


def _compute_total(items: list[ReportItem]) -> ReportItem:
    total_plan = sum(i.plan_minutes for i in items)
    total_fact = sum(i.fact_minutes for i in items)
    total_goal = sum(i.goal_minutes for i in items)
    return _build_item(
        order=0,
        caption="Всего",
        plan_minutes=total_plan,
        fact_minutes=total_fact,
        goal_minutes=total_goal,
    )


# ── Эндпоинт ──────────────────────────────────────────

@router.get("", response_model=ReportResponse)
async def get_report(
    interval_type: Literal["week", "month", "quarter", "year"] = Query(
        default="week", description="Тип интервала"
    ),
    interval_start: datetime | None = Query(
        default=None, description="Первый день интервала (UTC), 00:00"
    ),
    interval_end: datetime | None = Query(
        default=None, description="Последний день интервала (UTC), 00:00"
    ),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    """
    Сформировать отчёт о трудозатратах за указанный интервал.

    interval_start и interval_end — UTC datetime (фронт конвертирует локальную дату в UTC).

    🔐 Требует авторизацию (JWT Bearer token)
    """
    if not interval_start or not interval_end:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "interval_start и interval_end обязательны"},
        )

    # Вычисляем смещение локального времени клиента от UTC
    # interval_start — UTC время, соответствующее 00:00 в локальном времени клиента
    # Если час > 12, то UTC полночь относится к следующему локальному дню
    utc_midnight = datetime(interval_start.year, interval_start.month, interval_start.day, tzinfo=timezone.utc)
    if interval_start.hour > 12:
        # Полночь следующего дня UTC — это локальная полночь
        utc_midnight = utc_midnight + timedelta(days=1)
    tz_offset = utc_midnight - interval_start   # timedelta

    def _to_local(utc_dt: datetime) -> datetime:
        """Переводит UTC datetime в локальное время клиента."""
        return utc_dt + tz_offset
    
    def _to_utc(local_dt: datetime) -> datetime:
        """Переводит локальное время клиента в UTC datetime."""
        return local_dt - tz_offset

    items: list[ReportItem] = []

    if interval_type == "week":
        for i in range(7):
            day_start = interval_start + timedelta(days=i)
            day_end = day_start
            fact = await _get_fact_minutes(db, user_id, day_start, day_end, is_goal=False)
            goal = await _get_fact_minutes(db, user_id, day_start, day_end, is_goal=True)
            items.append(_build_item(i + 1, DAY_CAPTIONS[i], PLAN_PER_DAY, fact, goal))

    elif interval_type == "month":
        local_start_date = _to_local(interval_start).date()
        weeks = _weeks_in_interval(interval_start, interval_end, local_start_date)
        for idx, (mon, sun) in enumerate(weeks, 1):
            fact = await _get_fact_minutes(db, user_id, mon, sun, is_goal=False)
            goal = await _get_fact_minutes(db, user_id, mon, sun, is_goal=True)
            plan = PLAN_PER_DAY * 7
            local_mon = _to_local(mon)
            caption = f"{local_mon.day} {MONTH_NAMES_SHORT[local_mon.month]}"
            items.append(_build_item(idx, caption, plan, fact, goal))

    elif interval_type == "quarter":
        local_start_date = _to_local(interval_start).date()
        weeks = _weeks_in_interval(interval_start, interval_end, local_start_date)
        for idx, (mon, sun) in enumerate(weeks, 1):
            fact = await _get_fact_minutes(db, user_id, mon, sun, is_goal=False)
            goal = await _get_fact_minutes(db, user_id, mon, sun, is_goal=True)
            plan = PLAN_PER_DAY * 7
            local_mon = _to_local(mon)
            caption = f"{local_mon.day} {MONTH_NAMES_SHORT[local_mon.month]}"
            items.append(_build_item(idx, caption, plan, fact, goal))

    elif interval_type == "year":
        year = _to_local(interval_start).year
        for month in range(1, 13):
            first = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                last = datetime(year, 12, 31, tzinfo=timezone.utc)
            else:
                last = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(days=1)


            # logger.info("tz_offset", tz_offset=tz_offset)
            # logger.info("report_month_local", first=first.isoformat(), last=last.isoformat())
            # logger.info("report_month_utc", first=_to_utc(first).isoformat(), last=_to_utc(last).isoformat())

            fact = await _get_fact_minutes(db, user_id, _to_utc(first), _to_utc(last), is_goal=False)
            goal = await _get_fact_minutes(db, user_id, _to_utc(first), _to_utc(last), is_goal=True)

            days_in_month = (last - first).days + 1
            plan = PLAN_PER_DAY * days_in_month
            # Для года caption — название месяца, оно не зависит от смещения
            caption = MONTH_NAMES_SHORT[month]
            items.append(_build_item(month, caption, plan, fact, goal))

    total = _compute_total(items)

    return ReportResponse(items=items, total=total)
