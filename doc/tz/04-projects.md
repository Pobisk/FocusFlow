# ТЗ-04: Проекты и задачи

## 1. Цель модуля

Реализовать управление проектами и задачами. Проект — это набор действий для достижения результата. Задача — вырожденный проект в одно действие. Проекты/задачи привязываются к сферам и опционально к целям (проактивные). Без привязки к цели — реактивные.

## 2. Зависимости

- Модуль **01 — Авторизация** (защита эндпоинтов).
- Модуль **02 — Сферы жизни** (проект привязан к сфере).
- Модуль **03 — Цели** (проект опционально привязан к цели).

## 3. Модель данных

### 3.1. Project

Файл: `backend/src/models/project.py`

```python
from models.base import BaseModel
from sqlmodel import Field, Relationship
from uuid import UUID
from datetime import datetime
import enum

class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class ProjectType(str, enum.Enum):
    PROJECT = "project"  # проект с несколькими действиями
    TASK = "task"        # вырожденный проект в одно действие

class Project(BaseModel, table=True):
    __tablename__ = "projects"

    user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    sphere_id: UUID = Field(foreign_key="spheres.id", nullable=False, index=True)
    goal_id: UUID | None = Field(foreign_key="goals.id", default=None, index=True)
    title: str = Field(nullable=False, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    project_type: ProjectType = Field(nullable=False, default=ProjectType.PROJECT)
    status: ProjectStatus = Field(nullable=False, default=ProjectStatus.ACTIVE)
    start_date: datetime | None = Field(default=None)  # TIMESTAMPTZ, UTC
    target_date: datetime | None = Field(default=None)  # TIMESTAMPTZ, UTC
    progress: int = Field(nullable=False, default=0, ge=0, le=100)  # 0-100, может вычисляться
```

### 3.2. ChecklistItem

Чек-лист условий завершения проекта.

```python
class ChecklistItem(BaseModel, table=True):
    __tablename__ = "checklist_items"

    project_id: UUID = Field(foreign_key="projects.id", nullable=False, index=True)
    text: str = Field(nullable=False, max_length=500)
    is_completed: bool = Field(nullable=False, default=False)
    order: int = Field(nullable=False, default=0)
```

### 3.3. Миграции

**projects:**
- `id` — `sa.Uuid()`, PK
- `user_id` — `sa.Uuid()`, FK → users.id, not null, index
- `sphere_id` — `sa.Uuid()`, FK → spheres.id, not null, index
- `goal_id` — `sa.Uuid()`, FK → goals.id, nullable, index
- `title` — `sa.String(300)`, not null
- `description` — `sa.String(5000)`, nullable
- `project_type` — `sa.Enum(ProjectType)`, not null, default 'project'
- `status` — `sa.Enum(ProjectStatus)`, not null, default 'active'
- `start_date` — `sa.DateTime(timezone=True)`, nullable
- `target_date` — `sa.DateTime(timezone=True)`, nullable
- `progress` — `sa.Integer()`, not null, default 0
- `created_at`, `updated_at` — стандартные

**checklist_items:**
- `id` — `sa.Uuid()`, PK
- `project_id` — `sa.Uuid()`, FK → projects.id, not null, index
- `text` — `sa.String(500)`, not null
- `is_completed` — `sa.Boolean()`, not null, default False
- `order` — `sa.Integer()`, not null, default 0
- `created_at`, `updated_at` — стандартные

### 3.4. Схемы Pydantic

Файл: `backend/src/schemas/project.py`

```python
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional

class ChecklistItemRead(BaseModel):
    id: UUID
    text: str
    is_completed: bool
    order: int

class ChecklistItemCreate(BaseModel):
    text: str = Field(..., max_length=500)
    order: int = 0

class ProjectRead(BaseModel):
    id: UUID
    sphere_id: UUID
    sphere_code: str
    sphere_name: str
    goal_id: Optional[UUID]
    goal_title: Optional[str]
    title: str
    description: Optional[str]
    project_type: str
    status: str
    start_date: Optional[datetime]
    target_date: Optional[datetime]
    progress: int
    has_active_action: bool  # есть ли хотя бы одно активное действие
    checklist: list[ChecklistItemRead]
    created_at: datetime
    updated_at: datetime

class ProjectCreate(BaseModel):
    sphere_id: UUID
    goal_id: Optional[UUID] = None
    title: str = Field(..., max_length=300)
    description: Optional[str] = Field(default=None, max_length=5000)
    project_type: str = "project"
    start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    checklist: list[ChecklistItemCreate] = []

class ProjectUpdate(BaseModel):
    sphere_id: Optional[UUID] = None
    goal_id: Optional[UUID] = None
    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = Field(default=None, max_length=5000)
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)
```

## 4. Backend

### 4.1. Эндпоинты

Файл: `backend/src/api/endpoints/project.py`

Все эндпоинты защищены `Depends(get_current_user)`.

#### GET /api/projects

Параметры запроса:
- `sphere_id: UUID | None` — фильтр по сфере
- `goal_id: UUID | None` — фильтр по цели
- `status: str | None` — фильтр по статусу (по умолчанию "active")
- `project_type: str | None` — фильтр: "project" | "task"
- `period: str | None` — "week" | "month" | "quarter" | "year" (фильтр по target_date)
- `show_all: bool = False` — показать все статусы

Выход: список `ProjectRead`

Логика:
- Выбрать проекты для `user_id` с учётом фильтров.
- Для каждого проекта вычислить `has_active_action` (есть ли действие со статусом "active").
- Присоединить `sphere_code`, `sphere_name`, `goal_title`.
- Если `progress` не задан вручную — вычислить на основе чек-листа.
- Отсортировать: сначала с активными действиями, затем по target_date ASC.

#### GET /api/projects/{project_id}

Выход: `ProjectRead` (детальная информация, включая чек-лист)

#### POST /api/projects

Вход: `ProjectCreate`
Выход: `ProjectRead`

Логика:
- Проверить, что `sphere_id` и опционально `goal_id` принадлежат `user_id`.
- Если `project_type = "task"`, создать проект без чек-листа.
- Создать проект и пункты чек-листа.
- Вернуть созданный проект.

#### PUT /api/projects/{project_id}

Вход: `ProjectUpdate`
Выход: `ProjectRead`

#### DELETE /api/projects/{project_id}

Выход: `204 No Content`

Логика:
- Установить `status = "cancelled"` (soft delete).

#### PUT /api/projects/{project_id}/checklist/{item_id}

Вход: `{ "is_completed": bool }`
Выход: обновлённый пункт чек-листа

Логика:
- Переключить статус пункта чек-листа.
- Пересчитать `progress` проекта.

#### POST /api/projects/{project_id}/checklist

Вход: `ChecklistItemCreate`
Выход: созданный пункт чек-листа

#### DELETE /api/projects/{project_id}/checklist/{item_id}

Выход: `204 No Content`

## 5. Frontend

### 5.1. Страница проектов

Путь: `/projects` (доступна только авторизованным)

**Отображение:**
- Фильтр по сферам (компонент `SphereFilter`).
- Фильтр по периоду: кнопки "Неделя" "Месяц" "Квартал" "Год".
- Переключатель "Активные" / "Все".
- Список проектов/задач в виде карточек:
  - Код сферы + тип (иконка проекта или задачи)
  - Название
  - Привязка к цели (если есть)
  - Прогресс-бар
  - Статус
  - Индикатор "есть активное действие"
  - Кнопки: редактировать, удалить

**Действия:**
- Кнопка "Добавить проект" — модальное окно с полями:
  - Сфера (выпадающий список)
  - Тип: проект / задача (переключатель)
  - Цель (выпадающий список, опционально)
  - Название
  - Описание
  - Дата начала, дата завершения
  - Чек-лист (список строк с возможностью добавлять/удалять)
- При клике на проект — переход на страницу действий проекта.
- Редактирование чек-листа прямо в карточке (переключение is_completed).

### 5.2. Страница истории проектов

Путь: `/projects/history`

**Отображение:**
- Фильтр по сферам.
- Фильтр по кварталу (кнопки "Назад" / "Вперед").
- Список завершённых/отменённых проектов.
- Поиск по тексту (название, описание, комментарии).

### 5.3. API-клиент

После обновления `openapi.json` перегенерировать TypeScript-клиент.

## 6. Критерии готовности

- [ ] Модели Project и ChecklistItem созданы, миграции применены.
- [ ] CRUD эндпоинты для проектов работают.
- [ ] Чек-лист управляется через API.
- [ ] Прогресс вычисляется на основе чек-листа.
- [ ] Фильтрация по сфере, цели, периоду, статусу работает.
- [ ] Страница проектов отображается.
- [ ] Страница истории проектов отображается.
