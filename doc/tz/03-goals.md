# ТЗ-03: Цели

## 1. Цель модуля

Реализовать управление целями пользователя. Цель — это желаемый результат в определённой сфере жизни к указанному сроку. Цели делят проекты/задачи на проактивные (ведут к цели) и реактивные (текущие дела).

## 2. Зависимости

- Модуль **01 — Авторизация** (защита эндпоинтов).
- Модуль **02 — Сферы жизни** (цель привязана к сфере).
- Базовая модель `UserOwnedModel`.

## 3. Модель данных

### 3.1. Goal

Файл: `backend/src/models/goal.py`

```python
import enum
from models.base import UserOwnedModel, UTCDateTime
from sqlmodel import Field
from uuid import UUID
from datetime import datetime

class GoalStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Goal(UserOwnedModel, table=True):
    __tablename__ = "goals"

    # ✅ user_id, id, created_at, updated_at — унаследованы от UserOwnedModel

    sphere_id: UUID = Field(foreign_key="spheres.id", nullable=False, index=True)
    title: str = Field(nullable=False, max_length=300)
    description: str | None = Field(default=None, max_length=2000)
    deadline: datetime | None = Field(
        default=None,
        sa_type=UTCDateTime,  # ← TIMESTAMPTZ
    )
    status: GoalStatus = Field(nullable=False, default=GoalStatus.ACTIVE)
```

### 3.2. Миграция

Поля:
- `id` — `sa.Uuid()`, PK
- `user_id` — `sa.Uuid()`, FK → users.id, not null, index (унаследовано от UserOwnedModel)
- `sphere_id` — `sa.Uuid()`, FK → spheres.id, not null, index
- `title` — `sa.String(300)`, not null
- `description` — `sa.String(2000)`, nullable
- `deadline` — `sa.DateTime(timezone=True)`, nullable
- `status` — `sa.Enum(GoalStatus)`, not null, default 'active'
- `created_at`, `updated_at` — стандартные

### 3.3. Схемы Pydantic

Файл: `backend/src/schemas/goal.py`

```python
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional

class GoalRead(BaseModel):
    id: UUID
    sphere_id: UUID
    sphere_code: str  # из join со Sphere
    sphere_name: str
    title: str
    description: Optional[str]
    deadline: Optional[datetime]
    status: str
    progress: float  # вычисляемое поле: процент завершённых проектов/задач
    has_active_projects: bool  # есть ли активные проекты/задачи
    created_at: datetime
    updated_at: datetime

class GoalCreate(BaseModel):
    sphere_id: UUID
    title: str = Field(..., max_length=300)
    description: Optional[str] = Field(default=None, max_length=2000)
    deadline: Optional[datetime] = None

class GoalUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = Field(default=None, max_length=2000)
    deadline: Optional[datetime] = None
    status: Optional[str] = None  # "active" | "completed" | "cancelled"
    sphere_id: Optional[UUID] = None
```

## 4. Backend

### 4.1. Эндпоинты

Файл: `backend/src/api/endpoints/goal.py`

Все эндпоинты защищены `Depends(get_current_user)`.

#### GET /api/goals

Параметры запроса (query):
- `sphere_id: UUID | None` — фильтр по сфере
- `status: str | None` — фильтр по статусу (по умолчанию "active")
- `show_all: bool = False` — если True, показать все статусы

Выход: список `GoalRead`

Логика:
- Выбрать цели для `user_id` с учётом фильтров.
- Для каждой цели вычислить `progress` (процент проектов/задач со статусом "completed").
- Вычислить `has_active_projects` (есть ли хотя бы один проект/задача со статусом "active").
- Присоединить `sphere_code` и `sphere_name` из таблицы Sphere.
- Отсортировать по `deadline ASC` (сначала ближайшие).

#### GET /api/goals/{goal_id}

Выход: `GoalRead` (детальная информация по одной цели)

#### POST /api/goals

Вход: `GoalCreate`
Выход: `GoalRead`

Логика:
- Проверить, что `sphere_id` принадлежит `user_id`.
- Создать цель.
- Вернуть созданную цель.

#### PUT /api/goals/{goal_id}

Вход: `GoalUpdate`
Выход: `GoalRead`

Логика:
- Найти цель по `goal_id` и `user_id`.
- Обновить только переданные поля.
- Вернуть обновлённую цель.

#### DELETE /api/goals/{goal_id}

Выход: `204 No Content`

Логика:
- Найти цель по `goal_id` и `user_id`.
- Установить `status = "cancelled"` (soft delete).
- Вернуть 204.

## 5. Frontend

### 5.1. Страница целей

Путь: `/goals` (доступна только авторизованным)

**Отображение:**
- Фильтр по сферам (компонент `SphereFilter`).
- Переключатель "Активные" / "Все".
- Список целей в виде карточек:
  - Код сферы (буква) + название цели
  - Прогресс-бар (процент выполнения)
  - Срок (если есть)
  - Статус
  - Индикатор "есть активные проекты"
  - Кнопки: редактировать, удалить

**Действия:**
- Кнопка "Добавить цель" — модальное окно с полями: сфера (выпадающий список), название, описание, срок.
- Редактирование — модальное окно с теми же полями.
- Удаление — подтверждение, затем soft delete.
- При клике на цель — переход на страницу проектов/задач, отфильтрованных по этой цели.

### 5.2. API-клиент

После обновления `openapi.json` перегенерировать TypeScript-клиент.

## 6. Критерии готовности

- [ ] Модель Goal создана, миграция применена.
- [ ] CRUD эндпоинты для целей работают.
- [ ] Прогресс цели вычисляется корректно.
- [ ] Фильтрация по сфере и статусу работает.
- [ ] Страница целей отображается.
- [ ] Индикатор has_active_projects работает.
