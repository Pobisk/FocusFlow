"""Pydantic схемы для отчёта о трудозатратах."""
from pydantic import BaseModel, Field


class ReportItem(BaseModel):
    """Один элемент отчёта (день, неделя, месяц)."""
    order: int = Field(description="Порядковый номер для сортировки")
    caption: str = Field(description="Заголовок элемента, например 'ПН', '30 мар', 'янв'")
    plan_minutes: int = Field(description="Плановое время в минутах")
    fact_minutes: int = Field(description="Фактическое время в минутах")
    fact_percent: float = Field(description="Фактическое время в процентах от планового")
    goal_minutes: int = Field(description="Целевое время в минутах")
    goal_percent: float = Field(description="Целевое время в процентах от планового")


class ReportResponse(BaseModel):
    """Ответ отчёта."""
    items: list[ReportItem] = Field(description="Элементы отчёта")
    total: ReportItem = Field(description="Суммарный элемент отчёта")
