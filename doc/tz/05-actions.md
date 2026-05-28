# ТЗ-05: Действия

## 1. Цель модуля

Реализовать управление действиями — главным рабочим элементом системы. Действие — это конкретный шаг, который нужно выполнить в рамках проекта или задачи. Действия имеют приоритеты, статусы, временные параметры и могут быть привязаны ко времени (встречи).

## 2. Зависимости

- Модуль **01 — Авторизация** (защита эндпоинтов).
- Модуль **04 — Проекты и задачи** (действие привязано к проекту).

## 3. Модель данных

### 3.1. Action

Файл: `backend/src/models/action.py`

```python
from models.base import BaseModel
from sqlmodel import Field
from uuid import UUID
from datetime import datetime, date
import enum

class ActionStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    WAITING = "waiting"  # ожидание результата от кого-то

class Action(BaseModel, table=True):
    __tablename__ = "actions"

    user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    project_id: UUID = Field(foreign_key="projects.id", nullable=False, index=True)
    title: str = Field(nullable=False, max_length=500)
    description: str | None = Field(default=None, max_length=2000)

    # Привязка ко времени
    is_time_bound: bool = Field(nullable=False, default=False)  # точное время (встреча)
    start_date: datetime | None = Field(default=None)  # TIMESTAMPTZ, UTC
    end_date: datetime | None = Field(default=None)    # TIMESTAMPTZ, UTC
    exact_time: datetime | None = Field(default=None)  # для встреч: точное время
    travel_time_minutes: int | None = Field(default=None)  # время на дорогу (мин)

    # Приоритеты
    importance: int = Field(nullable=False, default=1, ge=0, le=3)    # важность 0-3
    consequences: int = Field(nullable=False, default=1, ge=0, le=3)  # последствия 0-3

    # Трудозатраты
    planned_duration_minutes: int | None = Field(default=None)  # планируемое время (мин)
    actual_duration_minutes: int | None = Field(default=None)   # фактическое время (мин)

    # Статус
    status: ActionStatus = Field(nullable=False, default=ActionStatus.ACTIVE)

    # Для статуса WAITING
    assignee: str | None = Field(default=None, max_length=200)  # исполнитель
    check_at: datetime | None = Field(default=None)  # когда проверить

    # Для алгоритма выбора
    refusal_count: int = Field(nullable=False, default=0)  # количество отказов
```

### 3.2. TimeLog (журнал времени)

Файл: `backend/src/models/time_log.py`

```python
class TimeLog(BaseModel, table=True):
    __tablename__ = "time_logs"

    user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    action_id: UUID = Field(foreign_key="actions.id", nullable=False, index=True)
    started_at: datetime = Field(nullable=False)  # TIMESTAMPTZ, UTC
    ended_at: datetime | None = Field(default=None)  # TIMESTAMPTZ, UTC
    duration_minutes: int | None = Field(default=None)  # вычисляется или вводится вручную
    note: str | None = Field(default=None, max_length=500)
```

### 3.3. Миграции

**actions:**
- `id` — `sa.Uuid()`, PK
- `user_id` — `sa.Uuid()`, FK → users.id, not null, index
- `project_id` — `sa.Uuid()`, FK → projects.id, not null, index
- `title` — `sa.String(500)`, not null
- `description` — `sa.String(2000)`, nullable
- `is_time_bound` — `sa.Boolean()`, not null, default False
- `start_date` — `sa.DateTime(timezone=True)`, nullable
- `end_date` — `sa.DateTime(timezone=True)`, nullable
- `exact_time` — `sa.DateTime(timezone=True)`, nullable
- `travel_time_minutes` — `sa.Integer()`, nullable
- `importance` — `sa.Integer()`, not null, default 1
- `consequences` — `sa.Integer()`, not null, default 1
- `planned_duration_minutes` — `sa.Integer()`, nullable
- `actual_duration_minutes` — `sa.Integer()`, nullable
- `status` — `sa.Enum(ActionStatus)`, not null, default 'active'
- `assignee` — `sa.String(200)`, nullable
- `check_at` — `sa.DateTime(timezone=True)`, nullable
- `refusal_count` — `sa.Integer()`, not null, default 0
- `created_at`, `updated_at` — стандартные

**time_logs:**
- `id` — `sa.Uuid()`, PK
- `user_id` — `sa.Uuid()`, FK → users.id, not null, index
- `action_id` — `sa.Uuid()`, FK → actions.id, not null, index
- `started_at` — `sa.DateTime(timezone=True)`, not null
- `ended_at` — `sa.DateTime(timezone=True)`, nullable
- `duration_minutes` — `sa.Integer()`, nullable
- `note` — `sa.String(500)`, nullable
- `created_at`, `updated_at` — стандартные

### 3.4. Схемы Pydantic

Файл: `backend/src/schemas/action.py`

```python
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional

class ActionRead(BaseModel):
    id: UUID
    project_id: UUID
    project_title: str
    sphere_code: str
    goal_id: Optional[UUID]
    goal_title: Optional[str]
    title: str
    description: Optional[str]
    is_time_bound: bool
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    exact_time: Optional[datetime]
    travel_time_minutes: Optional[int]
    importance: int
    consequences: int
    planned_duration_minutes: Optional[int]
    actual_duration_minutes: Optional[int]
    status: str
    assignee: Optional[str]
    check_at: Optional[datetime]
    refusal_count: int
    is_proactive: bool  # есть ли привязка к цели через проект
    created_at: datetime
    updated_at: datetime

class ActionCreate(BaseModel):
    project_id: UUID
    title: str = Field(..., max_length=500)
    description: Optional[str] = Field(default=None, max_length=2000)
    is_time_bound: bool = False
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    exact_time: Optional[datetime] = None
    travel_time_minutes: Optional[int] = None
    importance: int = 1
    consequences: int = 1
    planned_duration_minutes: Optional[int] = None

class ActionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = Field(default=None, max_length=2000)
    is_time_bound: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    exact_time: Optional[datetime] = None
    travel_time_minutes: Optional[int] = None
    importance: Optional[int] = None
    consequences: Optional[int] = None
    planned_duration_minutes: Optional[int] = None
    status: Optional[str] = None
    assignee: Optional[str] = None
    check_at: Optional[datetime] = None

class TimeLogRead(BaseModel):
    id: UUID
    action_id: UUID
    started_at: datetime
    ended_at: Optional[datetime]
    duration_minutes: Optional[int]
    note: Optional[str]

class TimeLogCreate(BaseModel):
    action_id: UUID
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    note: Optional[str] = None
```

## 4. Backend

### 4.1. Эндпоинты действий

Файл: `backend/src/api/endpoints/action.py`

Все эндпоинты защищены `Depends(get_current_user)`.

#### GET /api/actions

Параметры запроса:
- `project_id: UUID | None` — фильтр по проекту
- `status: str | None` — фильтр по статусу (по умолчанию "active")
- `sphere_id: UUID | None` — фильтр по сфере (через проект)
- `is_time_bound: bool | None` — только встречи
- `date_from: datetime | None` — начало периода
- `date_to: datetime | None` — конец периода

Выход: список `ActionRead`

Логика:
- Выбрать действия для `user_id` с учётом фильтров.
- Присоединить `project_title`, `sphere_code`, `goal_id`, `goal_title`.
- Вычислить `is_proactive` (project.goal_id is not null).
- Отсортировать по алгоритму выбора (см. ТЗ-07) или по датам.

#### GET /api/actions/{action_id}

Выход: `ActionRead`

#### POST /api/actions

Вход: `ActionCreate`
Выход: `ActionRead`

Логика:
- Проверить, что `project_id` принадлежит `user_id`.
- Если `is_time_bound = True`, заполнить `start_date` и `end_date` на основе `exact_time`.
- Создать действие.
- Вернуть созданное действие.

#### PUT /api/actions/{action_id}

Вход: `ActionUpdate`
Выход: `ActionRead`

#### DELETE /api/actions/{action_id}

Выход: `204 No Content`

Логика:
- Установить `status = "cancelled"` (soft delete).

#### POST /api/actions/{action_id}/refuse

Вход: `{ "reason": str }`
Выход: `ActionRead`

Логика:
- Увеличить `refusal_count` на 1.
- Записать причину отказа (в отдельную таблицу или в лог).
- Если `refusal_count >= 3` — отметить действие для пересмотра приоритетов.

### 4.2. Эндпоинты журнала времени

#### GET /api/actions/{action_id}/time-logs

Выход: список `TimeLogRead`

#### POST /api/time-logs

Вход: `TimeLogCreate`
Выход: `TimeLogRead`

Логика:
- Если `ended_at` передан, вычислить `duration_minutes`.
- Если `duration_minutes` передан вручную, использовать его.
- Обновить `actual_duration_minutes` в действии (сумма всех time_logs).

#### PUT /api/time-logs/{log_id}

Вход: частичное обновление `TimeLogCreate`
Выход: `TimeLogRead`

#### DELETE /api/time-logs/{log_id}

Выход: `204 No Content`

## 5. Frontend

### 5.1. Страница действий проекта

Путь: `/projects/{project_id}/actions`

**Отображение:**
- Заголовок проекта.
- Список действий проекта:
  - Название
  - Приоритеты (importance, consequences) — иконками или цифрами
  - Период (start_date — end_date)
  - Плановое время
  - Фактическое время
  - Статус
  - Кнопки: редактировать, удалить, начать работу

**Действия:**
- Кнопка "Добавить действие" — модальное окно с полями:
  - Название
  - Описание
  - Привязка ко времени (переключатель)
  - Если привязано: дата, время, время на дорогу
  - Если не привязано: дата начала, дата завершения
  - Важность (0-3)
  - Последствия (0-3)
  - Плановое время (минуты)
- Переключение статуса действия.
- Кнопка "Отказаться" — модальное окно с причиной отказа.

### 5.2. API-клиент

После обновления `openapi.json` перегенерировать TypeScript-клиент.

## 6. Критерии готовности

- [ ] Модели Action и TimeLog созданы, миграции применены.
- [ ] CRUD эндпоинты для действий работают.
- [ ] Журнал времени работает (старт/стоп/ручной ввод).
- [ ] Фильтрация действий работает.
- [ ] Механизм отказов работает (refusal_count).
- [ ] Страница действий проекта отображается.
