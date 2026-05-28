# ТЗ-02: Сферы жизни

## 1. Цель модуля

Создать справочник "Сферы жизни" — ключевой классификатор, к которому привязываются все сущности системы (цели, проекты, задачи, действия). Пользователь определяет свои сферы жизни (например: Финансы, Работа, Семья, Здоровье) и оценивает удовлетворённость каждой.

## 2. Зависимости

- Модуль **01 — Авторизация** (требуется `get_current_user`).
- Базовая модель `BaseModel`.

## 3. Модель данных

### 3.1. Sphere

Файл: `backend/src/models/sphere.py` (уже существует, доработать)

```python
from models.base import BaseModel
from sqlmodel import Field
from uuid import UUID

class Sphere(BaseModel, table=True):
    __tablename__ = "spheres"

    user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    code: str = Field(nullable=False, max_length=10)
    name: str = Field(nullable=False, max_length=200)
    order: int = Field(nullable=False, default=0)
    is_active: bool = Field(nullable=False, default=True)
    satisfaction: float = Field(nullable=False, default=3.0, ge=1.0, le=5.0)
```

### 3.2. Миграция

Создать Alembic-миграцию через `alembic revision --autogenerate`.

Поля:
- `id` — `sa.Uuid()`, PK
- `user_id` — `sa.Uuid()`, FK → users.id, not null, index
- `code` — `sa.String(10)`, not null
- `name` — `sa.String(200)`, not null
- `order` — `sa.Integer()`, not null, default 0
- `is_active` — `sa.Boolean()`, not null, default True
- `satisfaction` — `sa.Float()`, not null, default 3.0
- `created_at`, `updated_at` — стандартные

### 3.3. Схемы Pydantic

Файл: `backend/src/schemas/sphere.py`

```python
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class SphereRead(BaseModel):
    id: UUID
    code: str
    name: str
    order: int
    is_active: bool
    satisfaction: float
    created_at: datetime
    updated_at: datetime

class SphereCreate(BaseModel):
    code: str = Field(..., max_length=10, description="Однобуквенный или короткий код, например 'Ф', 'Р', 'Б'")
    name: str = Field(..., max_length=200)
    order: int = Field(default=0)
    satisfaction: float = Field(default=3.0, ge=1.0, le=5.0)

class SphereUpdate(BaseModel):
    code: str | None = Field(default=None, max_length=10)
    name: str | None = Field(default=None, max_length=200)
    order: int | None = None
    is_active: bool | None = None
    satisfaction: float | None = Field(default=None, ge=1.0, le=5.0)
```

## 4. Backend

### 4.1. Эндпоинты

Файл: `backend/src/api/endpoints/sphere.py` (уже существует, расширить)

Все эндпоинты защищены `Depends(get_current_user)`. `user_id` извлекается из токена.

#### GET /api/spheres

Вход: ничего
Выход: список `SphereRead`, отсортированный по `order`

Логика:
- Выбрать все сферы для `user_id`, где `is_active = True`.
- Отсортировать по `order ASC`.
- Вернуть список.

#### POST /api/spheres

Вход: `SphereCreate`
Выход: `SphereRead` (созданная сфера)

Логика:
- Проверить уникальность `code` в рамках `user_id`.
- Создать запись.
- Вернуть созданную сферу.

#### PUT /api/spheres/{sphere_id}

Вход: `SphereUpdate`
Выход: `SphereRead` (обновлённая сфера)

Логика:
- Найти сферу по `sphere_id` и `user_id`.
- Обновить только переданные поля.
- Вернуть обновлённую сферу.

#### DELETE /api/spheres/{sphere_id}

Выход: `204 No Content`

Логика:
- Найти сферу по `sphere_id` и `user_id`.
- Установить `is_active = False` (soft delete).
- Вернуть 204.

#### GET /api/spheres/{sphere_id}/history

Выход: список записей истории изменения `satisfaction`

Логика:
- Вернуть историю изменения оценки удовлетворённости для данной сферы (см. п. 4.2).

### 4.2. История удовлетворённости

При каждом изменении `satisfaction` сохранять запись в отдельную таблицу `sphere_satisfaction_history`:

```python
class SphereSatisfactionHistory(BaseModel, table=True):
    __tablename__ = "sphere_satisfaction_history"

    sphere_id: UUID = Field(foreign_key="spheres.id", nullable=False, index=True)
    satisfaction: float = Field(nullable=False)
    changed_at: datetime = Field(nullable=False)
```

Миграция для этой таблицы создаётся отдельно.

## 5. Frontend

### 5.1. Страница управления сферами

Путь: `/spheres` (доступна только авторизованным)

**Отображение:**
- Строка фильтра по сферам (кнопки с кодами сфер + кнопка "Все") — этот компонент будет переиспользоваться во всех модулях.
- Список сфер в виде карточек:
  - Код (буква)
  - Название
  - Оценка удовлетворённости (звёзды или ползунок 1-5)
  - Кнопки: редактировать, удалить

**Действия:**
- Кнопка "Добавить сферу" — модальное окно с полями: код, название, порядок сортировки, оценка.
- Редактирование — модальное окно с теми же полями.
- Удаление — подтверждение, затем soft delete.
- Изменение оценки — сразу сохранять на сервер (или после подтверждения).

### 5.2. Компонент фильтра сфер

Создать переиспользуемый компонент `SphereFilter`:

```tsx
// frontend/src/components/SphereFilter.tsx
// Props: spheres: Sphere[], selected: string | null, onSelect: (code: string | null) => void
// Отображает кнопки: "Все" + коды сфер
```

### 5.3. API-клиент (сгенерированный)

После обновления `openapi.json` перегенерировать TypeScript-клиент через `openapi-typescript`.

## 6. Критерии готовности

- [ ] Модель Sphere создана, миграция применена.
- [ ] CRUD эндпоинты для сфер работают.
- [ ] История изменения satisfaction сохраняется.
- [ ] Страница управления сферами отображается.
- [ ] Компонент SphereFilter создан и работает.
- [ ] Soft delete работает (is_active = false).
