"""Report endpoints — формирование отчёта о трудозатратах."""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Date as sa_Date
from datetime import datetime, timezone, date, timedelta
from typing import Literal

from db.session import get_db
from models.task import Task
from models.task_log import TaskLog
from core.auth import get_current_user_id
from schemas.report import ReportItem, ReportResponse
from uuid import UUID

router = APIRouter(prefix="/report", tags=["report"])

PLAN_PER_DAY = 480  # 8 часов * 60 минут

# ── Вспомогательные функции ───────────────────────────

def _get_week_range(d: date) -> tuple[date, date]:
    """Возвращает понедельник и воскресенье недели, содержащей d."""
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _weeks_in_month(year: int, month: int) -> list[tuple[date, date]]:
    """Возвращает список (пн, вс) недель, входящих в месяц (>=4 дней внутри месяца)."""
    import calendar
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])

    # Начинаем с понедельника первой недели, пересекающей месяц
    monday = first_day - timedelta(days=first_day.weekday())

    weeks: list[tuple[date, date]] = []
    while monday <= last_day:
        sunday = monday + timedelta(days=6)
        # Сколько дней этой недели попадает в месяц
        overlap_start = max(monday, first_day)
        overlap_end = min(sunday, last_day)
        overlap_days = (overlap_end - overlap_start).days + 1
        if overlap_days >= 4:
            weeks.append((monday, sunday))
        monday += timedelta(days=7)

    return weeks


def _weeks_in_quarter(year: int, quarter: int) -> list[tuple[date, date]]:
    """Возвращает список недель квартала (>=4 дней внутри квартала)."""
    start_month = (quarter - 1) * 3 + 1
    import calendar
    first_day = date(year, start_month, 1)
    last_month = start_month + 2
    last_day = date(year, last_month, calendar.monthrange(year, last_month)[1])

    monday = first_day - timedelta(days=first_day.weekday())
    weeks: list[tuple[date, date]] = []
    while monday <= last_day:
        sunday = monday + timedelta(days=6)
        overlap_start = max(monday, first_day)
        overlap_end = min(sunday, last_day)
        overlap_days = (overlap_end - overlap_start).days + 1
        if overlap_days >= 4:
            weeks.append((monday, sunday))
        monday += timedelta(days=7)
    return weeks


MONTH_NAMES_SHORT = ["", "янв", "фев", "мар", "апр", "май", "июн",
                      "июл", "авг", "сен", "окт", "ноя", "дек"]


async def _get_fact_minutes(
    db: AsyncSession,
    user_id: UUID,
    range_start: date,
    range_end: date,
    is_goal: bool = False,
) -> list[tuple[date, int]]:
    """Возвращает список (log_date, minutes_sum) за диапазон дат.
    Если is_goal=True — только для задач, привязанных к целям (goal_id IS NOT NULL).
    """
    query = select(
        func.cast(TaskLog.log_date, sa_Date).label("d"),
        func.sum(TaskLog.minutes).label("m"),
    ).join(
        Task, TaskLog.task_id == Task.id
    ).where(
        TaskLog.user_id == user_id,
        TaskLog.log_date >= range_start,
        TaskLog.log_date <= range_end,
    )

    if is_goal:
        query = query.where(Task.goal_id.is_not(None))

    query = query.group_by(func.cast(TaskLog.log_date, sa_Date))

    result = await db.execute(query)
    rows = result.all()
    return [(row.d, int(row.m)) for row in rows]


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
    first_day: str = Query(
        description="Первый день интервала в формате YYYY-MM-DD (локальная дата)"
    ),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    """
    Сформировать отчёт о трудозатратах за указанный интервал.

    🔐 Требует авторизацию (JWT Bearer token)
    """
    try:
        start_date = date.fromisoformat(first_day)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "Неверный формат даты. Используйте YYYY-MM-DD"},
        )

    items: list[ReportItem] = []

    if interval_type == "week":
        monday, sunday = _get_week_range(start_date)
        # Запрашиваем оба набора одним проходом
        all_fact = dict(await _get_fact_minutes(db, user_id, monday, sunday, is_goal=False))
        goal_fact = dict(await _get_fact_minutes(db, user_id, monday, sunday, is_goal=True))

        DAY_CAPTIONS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"]
        for i in range(7):
            d = monday + timedelta(days=i)
            fact = all_fact.get(d, 0)
            goal = goal_fact.get(d, 0)
            items.append(_build_item(i + 1, DAY_CAPTIONS[i], PLAN_PER_DAY, fact, goal))

    elif interval_type == "month":
        weeks = _weeks_in_month(start_date.year, start_date.month)
        for idx, (mon, sun) in enumerate(weeks, 1):
            all_fact = dict(await _get_fact_minutes(db, user_id, mon, sun, is_goal=False))
            goal_fact = dict(await _get_fact_minutes(db, user_id, mon, sun, is_goal=True))
            total_fact = sum(all_fact.get(mon + timedelta(days=i), 0) for i in range(7))
            total_goal = sum(goal_fact.get(mon + timedelta(days=i), 0) for i in range(7))
            plan = PLAN_PER_DAY * 7
            caption = f"{mon.day} {MONTH_NAMES_SHORT[mon.month]}"
            items.append(_build_item(idx, caption, plan, total_fact, total_goal))

    elif interval_type == "quarter":
        q = start_date.month
        quarter = (q - 1) // 3 + 1
        weeks = _weeks_in_quarter(start_date.year, quarter)
        for idx, (mon, sun) in enumerate(weeks, 1):
            all_fact = dict(await _get_fact_minutes(db, user_id, mon, sun, is_goal=False))
            goal_fact = dict(await _get_fact_minutes(db, user_id, mon, sun, is_goal=True))
            total_fact = sum(all_fact.get(mon + timedelta(days=i), 0) for i in range(7))
            total_goal = sum(goal_fact.get(mon + timedelta(days=i), 0) for i in range(7))
            plan = PLAN_PER_DAY * 7
            caption = f"{mon.day} {MONTH_NAMES_SHORT[mon.month]}"
            items.append(_build_item(idx, caption, plan, total_fact, total_goal))

    elif interval_type == "year":
        import calendar
        for month in range(1, 13):
            days_in_month = calendar.monthrange(start_date.year, month)[1]
            first = date(start_date.year, month, 1)
            last = date(start_date.year, month, days_in_month)
            all_fact = dict(await _get_fact_minutes(db, user_id, first, last, is_goal=False))
            goal_fact = dict(await _get_fact_minutes(db, user_id, first, last, is_goal=True))
            total_fact = sum(
                all_fact.get(date(start_date.year, month, d), 0)
                for d in range(1, days_in_month + 1)
            )
            total_goal = sum(
                goal_fact.get(date(start_date.year, month, d), 0)
                for d in range(1, days_in_month + 1)
            )
            plan = PLAN_PER_DAY * days_in_month
            caption = MONTH_NAMES_SHORT[month]
            items.append(_build_item(month, caption, plan, total_fact, total_goal))

    total = _compute_total(items)

    return ReportResponse(items=items, total=total)
